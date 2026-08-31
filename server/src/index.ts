import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { randomUUID } from "node:crypto";
import { pool, withTenant } from "./db/pool.js";
import {
  BadCode,
  TooManyRequests,
  callerFor,
  createTenant,
  requestCode,
  signOut,
  tenantsFor,
  verifyCode,
  type Caller,
} from "./lib/auth.js";
import { InvalidPhone } from "./lib/phone.js";
import { TooManyOps, cursorFor, pull, push, summary } from "./lib/sync.js";

/**
 * The API.
 *
 * Small on purpose. The client already contains every rule about how money
 * works, tested on its own; duplicating that here would give two places for it
 * to disagree. So this service does the four things a browser genuinely cannot:
 * remember who someone is, store their records durably, hand them to a second
 * device, and serve the public mini site to people who have never signed in.
 */

type Env = { Variables: { caller: Caller; tenantId: string } };

const app = new Hono<Env>();

app.use(
  "*",
  cors({
    // The static front end is deployed separately, so it is always cross-origin.
    origin: (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000").split(","),
    allowHeaders: ["content-type", "authorization"],
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    credentials: false,
  }),
);

/** Turns thrown domain errors into the right status, in one place. */
app.onError((error, c) => {
  if (error instanceof InvalidPhone) return c.json({ error: error.message }, 400);
  if (error instanceof TooManyRequests) return c.json({ error: error.message }, 429);
  if (error instanceof BadCode) return c.json({ error: error.message }, 401);
  if (error instanceof TooManyOps) return c.json({ error: error.message }, 413);
  console.error(error);
  return c.json({ error: "Something went wrong on our side." }, 500);
});

/**
 * Authentication, closed by default.
 *
 * The public surface is an explicit list rather than an ordering: a route
 * registered after the middleware used to fall through it silently, which is
 * how a private endpoint ends up public by accident. Anything not named here
 * needs a session, whenever and wherever it is added.
 */
const PUBLIC_PATHS = [
  /^\/health$/,
  /^\/auth\/code$/,
  /^\/auth\/verify$/,
  // The mini site is read by customers who have never signed in.
  /^\/store\/[^/]+$/,
];

app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") return next();
  const path = new URL(c.req.url).pathname;
  if (PUBLIC_PATHS.some((allowed) => allowed.test(path))) return next();

  const header = c.req.header("authorization") ?? "";
  const caller = await callerFor(header.replace(/^Bearer\s+/i, "") || undefined);
  if (!caller) return c.json({ error: "Sign in again." }, 401);
  c.set("caller", caller);
  await next();
});

app.get("/health", async (c) => {
  try {
    await pool.query("select 1");
    return c.json({ ok: true });
  } catch {
    return c.json({ ok: false }, 503);
  }
});

/* ------------------------------------------------------------------ *
 * Signing in
 * ------------------------------------------------------------------ */

app.post("/auth/code", async (c) => {
  const { phone } = await c.req.json<{ phone?: string }>();
  return c.json(await requestCode(phone ?? ""));
});

app.post("/auth/verify", async (c) => {
  const body = await c.req.json<{ phone?: string; code?: string; name?: string }>();
  const session = await verifyCode(body.phone ?? "", body.code ?? "", {
    name: body.name,
    userAgent: c.req.header("user-agent"),
  });
  return c.json(session);
});

const authed = new Hono<Env>();

authed.get("/me", async (c) => {
  const caller = c.get("caller");
  return c.json({ accountId: caller.accountId, tenants: caller.tenants });
});

authed.post("/auth/sign-out", async (c) => {
  await signOut((c.req.header("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  return c.json({ ok: true });
});

authed.post("/tenants", async (c) => {
  const body = await c.req.json<{ name?: string; industry?: string }>();
  if (!body.name?.trim()) return c.json({ error: "A business needs a name." }, 400);
  const tenant = await createTenant(c.get("caller").accountId, {
    name: body.name,
    industry: body.industry,
  });
  return c.json(tenant, 201);
});

/* ------------------------------------------------------------------ *
 * Sync
 * ------------------------------------------------------------------ */

/**
 * Membership is checked here rather than trusted from the request, because the
 * tenant id arrives from the client and a client can send any id it likes.
 */
const tenantScoped = new Hono<Env>();

tenantScoped.use("*", async (c, next) => {
  const tenantId = c.req.param("tenantId")!;
  const caller = c.get("caller");
  if (!caller.tenants.some((t) => t.id === tenantId)) {
    // Deliberately the same answer as a tenant that does not exist, so this
    // endpoint cannot be used to discover which businesses are real.
    return c.json({ error: "Not found." }, 404);
  }
  c.set("tenantId", tenantId);
  await next();
});

tenantScoped.get("/sync", async (c) => {
  const since = Number(c.req.query("since") ?? 0);
  const limit = Number(c.req.query("limit") ?? 500);
  return c.json(await pull(c.get("tenantId"), Number.isFinite(since) ? since : 0, limit));
});

tenantScoped.post("/sync", async (c) => {
  const body = await c.req.json<{
    batchId?: string;
    deviceId?: string;
    ops?: unknown[];
  }>();
  const ops = Array.isArray(body.ops) ? body.ops : [];
  const result = await push(
    c.get("tenantId"),
    // A missing batch id means the client loses idempotency, not that the push
    // fails — one generated here is still better than applying nothing.
    body.batchId ?? randomUUID(),
    ops as never,
    body.deviceId,
  );
  return c.json(result);
});

tenantScoped.get("/cursor", async (c) => c.json({ cursor: await cursorFor(c.get("tenantId")) }));
tenantScoped.get("/summary", async (c) => c.json(await summary(c.get("tenantId"))));

authed.route("/tenants/:tenantId", tenantScoped);
app.route("/", authed);

/* ------------------------------------------------------------------ *
 * The public mini site
 * ------------------------------------------------------------------ */

/**
 * Read by people who have never signed in, so it takes no token — and
 * therefore returns only what a seller has explicitly published. A hidden
 * product or an unpublished shop is not reachable from here.
 */
app.get("/store/:slug", async (c) => {
  const slug = c.req.param("slug");
  const { rows } = await pool.query<{ id: string; name: string }>(
    `select id, name from tenants where slug = $1 and suspended_at is null`,
    [slug],
  );
  const tenant = rows[0];
  if (!tenant) return c.json({ error: "No shop at that address." }, 404);

  const data = await withTenant(tenant.id, async (client) => {
    const { rows } = await client.query<{ kind: string; id: string; doc: Record<string, unknown> }>(
      `select kind, id, doc from records
        where tenant_id = $1 and deleted_at is null
          and kind in ('storefront', 'product', 'service')`,
      [tenant.id],
    );
    return rows;
  });

  const storefront = data.find((r) => r.kind === "storefront")?.doc;
  if (!storefront || storefront.published !== true) {
    return c.json({ error: "This shop is not published yet." }, 404);
  }

  const hidden = new Set((storefront.hiddenProductIds as string[] | undefined) ?? []);
  const visible = (kind: string) =>
    data
      .filter((r) => r.kind === kind && r.doc.active !== false && !hidden.has(r.id))
      .map((r) => r.doc);

  return c.json({
    business: { name: tenant.name, slug },
    storefront,
    products: visible("product"),
    services: visible("service"),
  });
});

const port = Number(process.env.PORT ?? 8787);

if (process.env.NODE_ENV !== "test") {
  serve({ fetch: app.fetch, port }, (info) =>
    console.log(`SokoOS API on http://localhost:${info.port}`),
  );
}

export { app };
