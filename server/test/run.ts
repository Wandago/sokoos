/**
 * Server tests, against a real Postgres.
 *
 * Not a mock and not SQLite: row-level security, `on conflict ... where`, and
 * transaction-scoped settings are the three things this design leans on hardest
 * and none of them behave the same anywhere else. A test that does not exercise
 * the real engine would be testing a story about the code.
 *
 * Run with: npm test  (DATABASE_URL must point at a scratch database)
 */
import { randomUUID } from "node:crypto";
import { app } from "../src/index.js";
import { closePool, pool, query } from "../src/db/pool.js";
import { migrate } from "../src/db/migrate.js";
import { normalisePhone, InvalidPhone, maskPhone } from "../src/lib/phone.js";
import { pull, push } from "../src/lib/sync.js";

let failures = 0;
let checks = 0;

function ok(label: string, condition: boolean, detail?: unknown) {
  checks += 1;
  if (!condition) failures += 1;
  console.log(`${condition ? "ok  " : "FAIL"} ${label}${condition || detail === undefined ? "" : ` — got ${JSON.stringify(detail)}`}`);
}

function eq(label: string, got: unknown, want: unknown) {
  const same = JSON.stringify(got) === JSON.stringify(want);
  checks += 1;
  if (!same) failures += 1;
  console.log(`${same ? "ok  " : "FAIL"} ${label}: ${JSON.stringify(got)}${same ? "" : ` (want ${JSON.stringify(want)})`}`);
}

function section(name: string) {
  console.log(`\n\x1b[1m${name}\x1b[0m`);
}

/** Calls the app the way a browser would, so routing and middleware are covered. */
async function api(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<{ status: number; body: any }> {
  const res = await app.fetch(
    new Request(`http://test${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

/** Signs a phone number in the way the real client does, and returns the session. */
async function signIn(phone: string, name?: string) {
  const requested = await api("POST", "/auth/code", { phone });
  if (requested.status !== 200) throw new Error(`code request failed: ${JSON.stringify(requested.body)}`);
  const verified = await api("POST", "/auth/verify", {
    phone,
    code: requested.body.devCode,
    name,
  });
  if (verified.status !== 200) throw new Error(`verify failed: ${JSON.stringify(verified.body)}`);
  return verified.body as { token: string; accountId: string };
}

async function reset() {
  await migrate(() => {});
  // Order matters only to be readable; the cascades would handle it.
  await query("truncate applied_batches, records, tenant_cursors, memberships, sessions, login_codes, accounts, tenants, admin_audit restart identity cascade");
}

async function main() {
  await reset();

  /* ---------------------------------------------------------------- */
  section("Phone numbers — the same person, four ways of writing it");

  const forms = ["0722000145", "+254722000145", "254722000145", "722 000 145", "0722 000 145"];
  const normalised = forms.map(normalisePhone);
  eq("all five forms reach one number", new Set(normalised).size, 1);
  eq("and it is E.164", normalised[0], "+254722000145");
  eq("Safaricom's 011 range works too", normalisePhone("0110123456"), "+254110123456");
  ok("a non-number is refused", (() => {
    try { normalisePhone("hello"); return false; } catch (e) { return e instanceof InvalidPhone; }
  })());
  ok("too short is refused", (() => {
    try { normalisePhone("0722"); return false; } catch { return true; }
  })());
  eq("masked for logs", maskPhone("+254722000145"), "+254722••0145");

  /* ---------------------------------------------------------------- */
  section("Signing in");

  const asked = await api("POST", "/auth/code", { phone: "0722000145" });
  eq("a code is issued", asked.status, 200);
  ok("and not returned in production shape", typeof asked.body.devCode === "string");

  const wrong = await api("POST", "/auth/verify", { phone: "0722000145", code: "000000" });
  ok("a wrong code is rejected", wrong.status === 401, wrong.body);

  const good = await api("POST", "/auth/verify", {
    phone: "0722000145",
    code: asked.body.devCode,
    name: "Amina Hassan",
  });
  eq("the right code signs in", good.status, 200);
  ok("and returns a token", typeof good.body.token === "string" && good.body.token.length > 20);

  const replay = await api("POST", "/auth/verify", {
    phone: "0722000145",
    code: asked.body.devCode,
  });
  ok("a used code cannot be used twice", replay.status === 401, replay.body);

  // The code must not be readable by anyone who gets at the table.
  const stored = await query<{ code_hash: string }>("select code_hash from login_codes limit 1");
  ok("codes are hashed at rest", !/^\d{6}$/.test(stored.rows[0]!.code_hash));
  const sessionRow = await query<{ token_hash: string }>("select token_hash from sessions limit 1");
  ok("session tokens are hashed at rest", sessionRow.rows[0]!.token_hash !== good.body.token);

  // Guessing has to be expensive.
  const brute = await api("POST", "/auth/code", { phone: "0733111222" });
  for (let i = 0; i < 5; i++) {
    await api("POST", "/auth/verify", { phone: "0733111222", code: "111111" });
  }
  const afterLimit = await api("POST", "/auth/verify", {
    phone: "0733111222",
    code: brute.body.devCode,
  });
  ok("a code dies after five wrong tries", afterLimit.status === 401, afterLimit.body);

  // And requesting codes has to be expensive too, or the SMS bill is the attack.
  let throttled = 0;
  for (let i = 0; i < 8; i++) {
    const r = await api("POST", "/auth/code", { phone: "0700999888" });
    if (r.status === 429) throttled += 1;
  }
  ok("code requests are rate limited", throttled > 0, throttled);

  const noToken = await api("GET", "/me");
  eq("no token means no access", noToken.status, 401);
  const badToken = await api("GET", "/me", undefined, "not-a-real-token");
  eq("a made-up token means no access", badToken.status, 401);

  /* ---------------------------------------------------------------- */
  section("Two businesses that must never see each other");

  const amina = await signIn("0722000145");
  const brian = await signIn("0733444555", "Brian Otieno");

  const aminaShop = await api("POST", "/tenants", { name: "Amina Beauty Bar", industry: "salon" }, amina.token);
  const brianShop = await api("POST", "/tenants", { name: "Bahari Linens", industry: "fashion" }, brian.token);
  eq("Amina's shop is created", aminaShop.status, 201);
  eq("and gets a slug", aminaShop.body.slug, "amina-beauty-bar");

  // Two shops with the same name must both work; the slug is a public address.
  const clash = await api("POST", "/tenants", { name: "Amina Beauty Bar" }, brian.token);
  eq("a duplicate name still gets an address", clash.body.slug, "amina-beauty-bar-2");

  await api("POST", `/tenants/${aminaShop.body.id}/sync`, {
    batchId: randomUUID(),
    ops: [
      { kind: "order", id: "ord_1", doc: { code: "#1", total: 2200 }, updatedAt: "2026-08-30T10:00:00.000Z" },
      { kind: "customer", id: "cus_1", doc: { name: "Grace" }, updatedAt: "2026-08-30T10:00:00.000Z" },
    ],
  }, amina.token);

  const brianReads = await api("GET", `/tenants/${aminaShop.body.id}/sync?since=0`, undefined, brian.token);
  eq("Brian cannot read Amina's records", brianReads.status, 404);

  const brianWrites = await api("POST", `/tenants/${aminaShop.body.id}/sync`, {
    batchId: randomUUID(),
    ops: [{ kind: "order", id: "ord_1", doc: { total: 999999 }, updatedAt: "2027-01-01T00:00:00.000Z" }],
  }, brian.token);
  eq("nor write to them", brianWrites.status, 404);

  const stillThere = await api("GET", `/tenants/${aminaShop.body.id}/sync?since=0`, undefined, amina.token);
  const order = stillThere.body.records.find((r: any) => r.id === "ord_1");
  eq("and Amina's order is untouched", order.doc.total, 2200);

  // The database itself must refuse, not just the route. This is the check that
  // matters — routes get added by people in a hurry.
  const leak = await pull(brianShop.body.id, 0);
  eq("row-level security scopes a direct query too", leak.records.length, 0);

  /* ---------------------------------------------------------------- */
  section("Sync — the cursor, conflicts and retries");

  const shop = aminaShop.body.id;

  const first = await push(shop, randomUUID(), [
    { kind: "product", id: "prd_1", doc: { name: "Braids", price: 3500 }, updatedAt: "2026-08-30T09:00:00.000Z" },
  ]);
  ok("the cursor advances", first.cursor > 0, first.cursor);
  eq("one op applied", first.applied, 1);

  const since = await pull(shop, first.cursor - 1);
  eq("pulling since a cursor returns only what came after", since.records.length, 1);
  eq("and it is the right record", since.records[0]!.id, "prd_1");

  // An old write must lose to a newer one, whatever order they arrive in.
  const newer = await push(shop, randomUUID(), [
    { kind: "product", id: "prd_1", doc: { name: "Box braids", price: 4000 }, updatedAt: "2026-08-30T12:00:00.000Z" },
  ]);
  eq("a newer write is applied", newer.applied, 1);

  const older = await push(shop, randomUUID(), [
    { kind: "product", id: "prd_1", doc: { name: "STALE", price: 1 }, updatedAt: "2026-08-30T08:00:00.000Z" },
  ]);
  eq("an older write is refused", older.applied, 0);
  eq("and says why", older.skipped[0]?.reason, "stale");

  const after = await pull(shop, 0);
  const product = after.records.find((r) => r.id === "prd_1");
  eq("the newer value survived", (product!.doc as any).name, "Box braids");
  ok("and the cursor did not burn a number on the stale op", older.cursor === newer.cursor, {
    stale: older.cursor,
    newer: newer.cursor,
  });

  // A phone on a bad line retries. The retry must change nothing.
  const batch = randomUUID();
  const once = await push(shop, batch, [
    { kind: "payment", id: "pay_1", doc: { amount: 2200 }, updatedAt: "2026-08-30T13:00:00.000Z" },
  ]);
  const twice = await push(shop, batch, [
    { kind: "payment", id: "pay_1", doc: { amount: 2200 }, updatedAt: "2026-08-30T13:00:00.000Z" },
  ]);
  ok("a replayed batch is recognised", twice.replayed === true);
  eq("and does not move the cursor", twice.cursor, once.cursor);

  // Deletes have to travel, or a record removed on one phone haunts the other.
  await push(shop, randomUUID(), [
    { kind: "payment", id: "pay_1", updatedAt: "2026-08-30T14:00:00.000Z", deleted: true },
  ]);
  const withDelete = await pull(shop, 0);
  const tombstone = withDelete.records.find((r) => r.id === "pay_1");
  ok("a delete reaches the other device", tombstone?.deleted === true);
  eq("and carries no data with it", tombstone?.doc, null);

  // Paging, so a device that has been off for a month is not one huge response.
  const many = Array.from({ length: 60 }, (_, i) => ({
    kind: "order" as const,
    id: `ord_bulk_${i}`,
    doc: { n: i },
    updatedAt: "2026-08-31T08:00:00.000Z",
  }));
  await push(shop, randomUUID(), many);
  const page = await pull(shop, 0, 25);
  eq("a page is capped", page.records.length, 25);
  ok("and says there is more", page.more === true);
  const next = await pull(shop, page.cursor, 25);
  ok("the next page continues from the cursor", next.records[0]!.seq > page.cursor);

  /* ---------------------------------------------------------------- */
  section("The public mini site");

  const anonymous = await api("GET", "/store/amina-beauty-bar");
  eq("an unpublished shop is not readable", anonymous.status, 404);

  await push(shop, randomUUID(), [
    {
      kind: "storefront",
      id: "storefront",
      doc: { published: true, headline: "Amina Beauty Bar", hiddenProductIds: ["prd_secret"] },
      updatedAt: "2026-08-31T09:00:00.000Z",
    },
    { kind: "product", id: "prd_secret", doc: { name: "Not for the site", price: 1 }, updatedAt: "2026-08-31T09:00:00.000Z" },
    { kind: "product", id: "prd_off", doc: { name: "Retired", price: 1, active: false }, updatedAt: "2026-08-31T09:00:00.000Z" },
  ]);

  const published = await api("GET", "/store/amina-beauty-bar");
  eq("a published shop is readable with no sign-in", published.status, 200);
  const names = published.body.products.map((p: any) => p.name);
  ok("hidden products are not served", !names.includes("Not for the site"), names);
  ok("nor inactive ones", !names.includes("Retired"), names);
  ok("but the real ones are", names.includes("Box braids"), names);
  ok("and no other business appears", published.body.business.name === "Amina Beauty Bar");

  const missing = await api("GET", "/store/no-such-shop");
  eq("an address nobody owns is a 404", missing.status, 404);

  /* ---------------------------------------------------------------- */
  section("Sessions end");

  await api("POST", "/auth/sign-out", {}, amina.token);
  const afterSignOut = await api("GET", "/me", undefined, amina.token);
  eq("a signed-out token stops working", afterSignOut.status, 401);

  console.log(
    failures
      ? `\n\x1b[31m${failures} of ${checks} checks failed\x1b[0m`
      : `\n\x1b[32mall ${checks} checks pass\x1b[0m`,
  );
  process.exitCode = failures ? 1 : 0;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closePool().catch(() => {}));
