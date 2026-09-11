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
  verifyCode,
  type Caller,
} from "./lib/auth.js";
import { InvalidPhone } from "./lib/phone.js";
import { TooManyOps, cursorFor, pull, push, summary } from "./lib/sync.js";
import {
  DarajaError,
  NoMpesaAccount,
  connectTill,
  handleConfirmation,
  handleStkResult,
  registerCallbacks,
  requestPayment,
  tillStatus,
  unmatchedEvents,
} from "./lib/mpesa.js";
import { MissingKey } from "./lib/crypto.js";
import { BadCredentials, adminCallerFor, adminLogin, adminSignOut, type AdminCaller } from "./lib/admin-auth.js";
import {
  NoSuchMerchant,
  listMerchants,
  merchantDetail,
  overview,
  reinstateMerchant,
  revenue,
  suspendMerchant,
  systemHealth,
} from "./lib/admin.js";
import { NoSuchShop, NoSuchReport, fileReport, listReports, setReportStatus } from "./lib/reports.js";
import { NoSuchTicket, assignTicket, fileTicket, listTickets, setTicketStatus } from "./lib/tickets.js";

/**
 * The API.
 *
 * Small on purpose. The client already contains every rule about how money
 * works, tested on its own; duplicating that here would give two places for it
 * to disagree. So this service does the four things a browser genuinely cannot:
 * remember who someone is, store their records durably, hand them to a second
 * device, and serve the public mini site to people who have never signed in.
 */

type Env = { Variables: { caller: Caller; tenantId: string; admin: AdminCaller } };

const app = new Hono<Env>();

app.use(
  "*",
  cors({
    /* The static front end is deployed separately, so it is always
     * cross-origin. Read straight from the environment: this module only
     * builds the app, and whatever starts it has already validated config. */
    origin: (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000").split(",").map((o) => o.trim()),
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
  if (error instanceof NoMpesaAccount) return c.json({ error: error.message }, 404);
  if (error instanceof DarajaError) return c.json({ error: error.message }, 502);
  if (error instanceof BadCredentials) return c.json({ error: error.message }, 401);
  if (error instanceof NoSuchMerchant) return c.json({ error: error.message }, 404);
  if (error instanceof NoSuchShop) return c.json({ error: error.message }, 404);
  if (error instanceof NoSuchReport) return c.json({ error: error.message }, 404);
  if (error instanceof NoSuchTicket) return c.json({ error: error.message }, 404);
  if (error instanceof MissingKey) {
    console.error(error.message);
    return c.json({ error: "Payments are not configured on this server." }, 503);
  }
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
  // Reporting a shop is exactly the same customer — nothing here should ever
  // require the sign-in the report is likely about avoiding.
  /^\/store\/[^/]+\/report$/,
  /* Safaricom's servers call these and cannot hold a session. The secret in
   * the URL is what identifies the seller, and the payload's shortcode is
   * checked against that seller's own before anything is written. */
  /^\/mpesa\/c2b\/[^/]+\/(confirmation|validation)$/,
  /^\/mpesa\/stk\/[^/]+$/,
];

app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") return next();
  const path = new URL(c.req.url).pathname;
  // The operator console has its own sign-in and its own guard below — a
  // seller session proves nothing about admin access, and an admin session
  // is not a tenant to scope seller routes by.
  if (PUBLIC_PATHS.some((allowed) => allowed.test(path)) || path.startsWith("/admin/")) {
    return next();
  }

  const header = c.req.header("authorization") ?? "";
  const caller = await callerFor(header.replace(/^Bearer\s+/i, "") || undefined);
  if (!caller) return c.json({ error: "Sign in again." }, 401);
  c.set("caller", caller);
  await next();
});

/**
 * The operator console's own gate. Everything under /admin needs a real,
 * server-verified session — `/admin/login` is the one door in.
 */
app.use("/admin/*", async (c, next) => {
  if (c.req.method === "OPTIONS" || c.req.path === "/admin/login") return next();
  const header = c.req.header("authorization") ?? "";
  const admin = await adminCallerFor(header.replace(/^Bearer\s+/i, "") || undefined);
  if (!admin) return c.json({ error: "Sign in again." }, 401);
  c.set("admin", admin);
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

/* ------------------------------------------------------------------ *
 * The seller's own till
 * ------------------------------------------------------------------ */

/** Where Safaricom should call back. Behind a proxy the host header is the truth. */
function publicBase(c: { req: { url: string; header: (name: string) => string | undefined } }) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const forwarded = c.req.header("x-forwarded-host");
  const proto = c.req.header("x-forwarded-proto") ?? "https";
  if (forwarded) return `${proto}://${forwarded}`;
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}`;
}

tenantScoped.get("/mpesa", async (c) =>
  c.json((await tillStatus(c.get("tenantId"), publicBase(c))) ?? { connected: false }),
);

tenantScoped.post("/mpesa", async (c) => {
  const body = await c.req.json<{
    kind?: "paybill" | "till";
    shortcode?: string;
    consumerKey?: string;
    consumerSecret?: string;
    passkey?: string;
    environment?: "sandbox" | "production";
  }>();

  if (!body.shortcode?.trim() || !body.consumerKey?.trim() || !body.consumerSecret?.trim()) {
    return c.json({ error: "The shortcode, consumer key and secret are all needed." }, 400);
  }

  await connectTill(c.get("tenantId"), {
    kind: body.kind ?? "till",
    shortcode: body.shortcode,
    consumerKey: body.consumerKey,
    consumerSecret: body.consumerSecret,
    passkey: body.passkey,
    environment: body.environment ?? "sandbox",
  });

  // Never echo credentials back, not even the ones just sent.
  return c.json(await tillStatus(c.get("tenantId"), publicBase(c)), 201);
});

tenantScoped.post("/mpesa/register", async (c) =>
  c.json(await registerCallbacks(c.get("tenantId"), publicBase(c))),
);

tenantScoped.post("/mpesa/request", async (c) => {
  const body = await c.req.json<{ phone?: string; amount?: number; reference?: string }>();
  if (!body.phone || !body.amount || !body.reference) {
    return c.json({ error: "A phone number, an amount and an order reference are needed." }, 400);
  }
  return c.json(
    await requestPayment(
      c.get("tenantId"),
      { phone: body.phone, amount: body.amount, reference: body.reference },
      publicBase(c),
    ),
  );
});

tenantScoped.get("/mpesa/unmatched", async (c) => c.json(await unmatchedEvents(c.get("tenantId"))));

/* ------------------------------------------------------------------ *
 * The seller's own support tickets
 * ------------------------------------------------------------------ */

tenantScoped.post("/support", async (c) => {
  const body = await c.req.json<{ subject?: string; message?: string; priority?: string }>();
  if (!body.subject?.trim() || !body.message?.trim()) {
    return c.json({ error: "A subject and message are needed." }, 400);
  }
  const ticket = await fileTicket(
    c.get("tenantId"),
    { subject: body.subject, message: body.message, priority: body.priority },
    c.get("caller").accountId,
  );
  return c.json(ticket, 201);
});

tenantScoped.get("/cursor", async (c) => c.json({ cursor: await cursorFor(c.get("tenantId")) }));
tenantScoped.get("/summary", async (c) => c.json(await summary(c.get("tenantId"))));

authed.route("/tenants/:tenantId", tenantScoped);
app.route("/", authed);

/* ------------------------------------------------------------------ *
 * Safaricom's callbacks
 * ------------------------------------------------------------------ */

/**
 * Validation. Safaricom asks whether to accept a payment before taking it.
 *
 * This always accepts. Refusing would mean a customer standing at a counter is
 * told their payment failed because our service was slow — the seller's money
 * should arrive whatever is wrong on our side, and anything we could not
 * understand is recoverable from the statement importer later.
 */
/* Whether the customer entered their PIN. Answers 0 whatever happened, for the
 * same reason the confirmation does: a non-zero answer makes Safaricom retry a
 * result that is already final. */
app.post("/mpesa/stk/:secret", async (c) => {
  try {
    const result = await handleStkResult(c.req.param("secret"), await c.req.json());
    if (result.status !== "accepted") {
      console.warn(`[mpesa] stk ${result.status}: ${result.detail}`);
    }
  } catch (error) {
    console.error("[mpesa] stk result failed", error);
  }
  return c.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

app.post("/mpesa/c2b/:secret/validation", async (c) =>
  c.json({ ResultCode: 0, ResultDesc: "Accepted" }),
);

/**
 * Confirmation. The money has already reached the seller's till; this is only
 * being told about it.
 *
 * Always answers 0, even when the payload is rejected. A non-zero result makes
 * Safaricom retry, and a payload we will never understand would then be retried
 * forever. What actually happened is recorded in `mpesa_events` either way.
 */
app.post("/mpesa/c2b/:secret/confirmation", async (c) => {
  let payload: Record<string, unknown> = {};
  try {
    payload = await c.req.json();
  } catch {
    payload = {};
  }

  const result = await handleConfirmation(c.req.param("secret"), payload).catch((error) => {
    console.error("[mpesa] confirmation failed", error);
    return { status: "rejected" as const, reason: "Internal error." };
  });

  if (result.status !== "posted") {
    console.warn(`[mpesa] ${result.status}${result.reason ? `: ${result.reason}` : ""}`);
  }
  return c.json({ ResultCode: 0, ResultDesc: "Accepted" });
});

/* ------------------------------------------------------------------ *
 * The operator console
 * ------------------------------------------------------------------ */

app.post("/admin/login", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string }>();
  return c.json(await adminLogin(body.email ?? "", body.password ?? ""));
});

app.post("/admin/sign-out", async (c) => {
  await adminSignOut((c.req.header("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  return c.json({ ok: true });
});

app.get("/admin/overview", async (c) => c.json(await overview()));
app.get("/admin/revenue", async (c) => c.json(await revenue()));
app.get("/admin/system", async (c) => c.json(await systemHealth()));

app.get("/admin/reports", async (c) => c.json(await listReports()));

app.post("/admin/reports/:id/status", async (c) => {
  const body = await c.req.json<{ status?: string }>();
  const status = body.status;
  if (status !== "reviewing" && status !== "upheld" && status !== "dismissed") {
    return c.json({ error: "A valid status is required." }, 400);
  }
  const { tenantId } = await setReportStatus(c.req.param("id"), status, c.get("admin").email);
  /* Upholding a report suspends the merchant and takes their storefront
   * offline — the same action the admin could take from the merchant record
   * itself, just triggered from the report that justified it. */
  if (status === "upheld") {
    await suspendMerchant(
      tenantId,
      c.get("admin").email,
      `Report upheld: ${c.req.param("id")}`,
    );
  }
  return c.json(await listReports());
});

app.get("/admin/tickets", async (c) => c.json(await listTickets()));

app.post("/admin/tickets/:id/status", async (c) => {
  const body = await c.req.json<{ status?: string }>();
  const status = body.status;
  if (status !== "open" && status !== "pending" && status !== "solved") {
    return c.json({ error: "A valid status is required." }, 400);
  }
  await setTicketStatus(c.req.param("id"), status);
  return c.json(await listTickets());
});

app.post("/admin/tickets/:id/assign", async (c) => {
  const body = await c.req.json<{ assignee?: string }>();
  await assignTicket(c.req.param("id"), body.assignee?.trim() || c.get("admin").email);
  return c.json(await listTickets());
});

app.get("/admin/merchants", async (c) => c.json(await listMerchants()));

app.get("/admin/merchants/:id", async (c) => {
  const merchant = await merchantDetail(c.req.param("id"));
  if (!merchant) return c.json({ error: "No business with that id." }, 404);
  return c.json(merchant);
});

app.post("/admin/merchants/:id/suspend", async (c) => {
  const body = await c.req.json<{ reason?: string }>().catch(() => ({}) as { reason?: string });
  await suspendMerchant(c.req.param("id"), c.get("admin").email, body.reason);
  return c.json(await merchantDetail(c.req.param("id")));
});

app.post("/admin/merchants/:id/reinstate", async (c) => {
  await reinstateMerchant(c.req.param("id"), c.get("admin").email);
  return c.json(await merchantDetail(c.req.param("id")));
});

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

app.post("/store/:slug/report", async (c) => {
  const body = await c.req.json<{ reason?: string; detail?: string; contact?: string }>();
  if (!body.detail?.trim()) return c.json({ error: "Say what's wrong." }, 400);
  await fileReport(c.req.param("slug"), {
    reason: body.reason,
    detail: body.detail,
    reporterContact: body.contact,
  });
  return c.json({ ok: true }, 201);
});

export { app };
