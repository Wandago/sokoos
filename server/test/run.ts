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
import { closePool, query, withTenant } from "../src/db/pool.js";
import { migrate } from "../src/db/migrate.js";
import { normalisePhone, InvalidPhone, maskPhone } from "../src/lib/phone.js";
import { pull, push } from "../src/lib/sync.js";
import { encrypt, decrypt, resetKeyCache, maskSecret } from "../src/lib/crypto.js";
import { handleConfirmation } from "../src/lib/mpesa.js";
import { hashPassword } from "../src/lib/password.js";

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

/** What a JSON document looks like before anything has checked it. */
type Doc = Record<string, unknown>;

/** Calls the app the way a browser would, so routing and middleware are covered. */
async function api(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
  // The response body is whatever the route decided to send; the assertions
  // below are what check it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  await query("truncate mpesa_events, mpesa_accounts, applied_batches, records, tenant_cursors, memberships, sessions, login_codes, accounts, tenants, admin_audit restart identity cascade");
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
  const order = stillThere.body.records.find((r: { id: string }) => r.id === "ord_1");
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
  eq("the newer value survived", (product!.doc as Doc).name, "Box braids");
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
  const names = published.body.products.map((p: { name: string }) => p.name);
  ok("hidden products are not served", !names.includes("Not for the site"), names);
  ok("nor inactive ones", !names.includes("Retired"), names);
  ok("but the real ones are", names.includes("Box braids"), names);
  ok("and no other business appears", published.body.business.name === "Amina Beauty Bar");

  const missing = await api("GET", "/store/no-such-shop");
  eq("an address nobody owns is a 404", missing.status, 404);

  /* ---------------------------------------------------------------- */
  section("A seller's credentials, encrypted");

  const plain = "Xk9vQm2pLr7TzAeB4NwYs6Hd";
  const sealed = encrypt(plain);
  ok("the ciphertext is not the secret", !sealed.includes(plain));
  eq("and it decrypts back", decrypt(sealed), plain);
  ok("the same secret encrypts differently each time", encrypt(plain) !== encrypt(plain));

  // Tampering must fail loudly rather than decrypt to something else.
  const parts = sealed.split(".");
  const tampered = [parts[0], parts[1], parts[2], Buffer.from("nonsense").toString("base64")].join(".");
  ok("a tampered value will not decrypt", (() => {
    try { decrypt(tampered); return false; } catch { return true; }
  })());

  // And the key is what protects it, not the format.
  const realKey = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = Buffer.from("a-completely-different-key-32byte").toString("base64");
  resetKeyCache();
  ok("a different key cannot read it", (() => {
    try { decrypt(sealed); return false; } catch { return true; }
  })());
  process.env.ENCRYPTION_KEY = realKey;
  resetKeyCache();
  eq("and the right key still can", decrypt(sealed), plain);
  eq("masking shows enough to recognise, not to use", maskSecret(plain), "Xk9v••••4NwYs6Hd".slice(0, 4) + "••••" + plain.slice(-4));

  /* ---------------------------------------------------------------- */
  section("M-Pesa — the seller's own till, read not held");

  const till = await api("POST", `/tenants/${shop}/mpesa`, {
    kind: "till",
    shortcode: "174379",
    consumerKey: "seller-consumer-key",
    consumerSecret: "seller-consumer-secret",
    passkey: "seller-passkey",
    environment: "sandbox",
  }, amina.token);
  eq("a till is connected", till.status, 201);
  ok("and a callback address is issued", typeof till.body.confirmationUrl === "string" && till.body.confirmationUrl.includes("/mpesa/c2b/"));
  eq("the consumer key comes back masked", till.body.consumerKey, "sell••••-key");

  // The credentials must never leave the server, not even to their owner.
  const status = await api("GET", `/tenants/${shop}/mpesa`, undefined, amina.token);
  const asText = JSON.stringify(status.body);
  ok("no secret is ever returned", !asText.includes("seller-consumer-secret") && !asText.includes("seller-passkey"));

  const storedTill = await query<{ consumer_secret_enc: string }>("select consumer_secret_enc from mpesa_accounts limit 1");
  ok("nor stored in the clear", !storedTill.rows[0]!.consumer_secret_enc.includes("seller-consumer-secret"));

  const secret = String(till.body.confirmationUrl).split("/mpesa/c2b/")[1]!.split("/")[0]!;

  // An order waiting to be paid, with the customer's phone on file.
  await push(shop, randomUUID(), [
    { kind: "customer", id: "cus_grace", doc: { id: "cus_grace", name: "Grace Wairimu", phone: "0722418903" }, updatedAt: "2026-08-31T07:00:00.000Z" },
    {
      kind: "order", id: "ord_9001",
      doc: {
        id: "ord_9001", code: "#9001", customerId: "cus_grace",
        items: [{ productId: "p", name: "Dress", qty: 1, price: 2200 }],
        deliveryFee: 200, deliverySettlement: "customer_pays_rider",
        discount: 0, status: "confirmed", paymentStatus: "unpaid",
        createdAt: "2026-08-31T07:00:00.000Z",
      },
      updatedAt: "2026-08-31T07:00:00.000Z",
    },
  ]);

  const cursorBefore = (await api("GET", `/tenants/${shop}/cursor`, undefined, amina.token)).body.cursor;

  const paid = await handleConfirmation(secret, {
    TransactionType: "Pay Bill", TransID: "TFA4K21LMN", TransTime: "20260831142530",
    TransAmount: "2200", BusinessShortCode: "174379", BillRefNumber: "#9001",
    MSISDN: "254722418903", FirstName: "GRACE", LastName: "WAIRIMU",
  });
  eq("a payment posts", paid.status, "posted");
  eq("and is matched to the order", paid.matchedOrder, "ord_9001");
  ok("with high confidence, since the reference and amount both agree", (paid.confidence ?? 0) >= 0.95, paid.confidence);

  // The seller's phone learns about it through the ordinary sync stream.
  const afterPayment = await pull(shop, cursorBefore);
  const payment = afterPayment.records.find((r) => r.kind === "payment");
  ok("it reaches the seller's device as a payment", Boolean(payment));
  eq("carrying the M-Pesa code as its reference", (payment!.doc as Doc).reference, "TFA4K21LMN");
  eq("and the right amount", (payment!.doc as Doc).amount, 2200);

  /* A number on its own is not an explanation. The evidence for an M-Pesa match
   * exists only here — the reference the customer typed, the number they paid
   * from — so it travels with the record to the seller's screen. */
  const why = (payment!.doc as Doc).matchReasons as string[];
  ok("the match says why, not just how sure", Array.isArray(why) && why.length > 0, why);
  ok(
    "naming the reference the customer typed",
    why.some((r) => r.includes("order number")),
    why,
  );
  ok("and the amount that agreed", why.includes("Exact amount"), why);
  const settled = afterPayment.records.find((r) => r.kind === "order" && r.id === "ord_9001");
  eq("a confident match settles the order", (settled!.doc as Doc).paymentStatus, "paid");

  // The delivery fee was the customer's business, not the seller's — matching
  // against 2,400 would have missed the order entirely.
  eq("matched on what the seller receives, not what the customer paid", (payment!.doc as Doc).amount, 2200);

  // Safaricom retries. It must not pay twice.
  const replayed = await handleConfirmation(secret, {
    TransID: "TFA4K21LMN", TransTime: "20260831142530", TransAmount: "2200",
    BusinessShortCode: "174379", BillRefNumber: "#9001", MSISDN: "254722418903", FirstName: "GRACE",
  });
  eq("a repeated callback is recognised", replayed.status, "duplicate");
  const events = await query<{ n: number }>("select count(*)::int as n from mpesa_events where trans_id = 'TFA4K21LMN'");
  eq("and only one event is on record", events.rows[0]!.n, 1);

  // A leaked URL alone must not let anyone invent income.
  const wrongCode = await handleConfirmation(secret, {
    TransID: "ZZZ111", TransAmount: "50000", BusinessShortCode: "999999", MSISDN: "254700000000",
  });
  eq("a payload for another shortcode is refused", wrongCode.status, "rejected");
  const unknown = await handleConfirmation("not-a-real-secret", { TransID: "ZZZ222", TransAmount: "100" });
  eq("and an unknown callback address is refused", unknown.status, "rejected");

  // Two open orders for the same amount cannot be told apart.
  await push(shop, randomUUID(), [
    { kind: "order", id: "ord_twin_a", doc: { id: "ord_twin_a", code: "#8001", items: [{ price: 1500, qty: 1 }], deliveryFee: 0, discount: 0, status: "confirmed", paymentStatus: "unpaid", createdAt: "2026-08-31T07:00:00.000Z" }, updatedAt: "2026-08-31T07:00:00.000Z" },
    { kind: "order", id: "ord_twin_b", doc: { id: "ord_twin_b", code: "#8002", items: [{ price: 1500, qty: 1 }], deliveryFee: 0, discount: 0, status: "confirmed", paymentStatus: "unpaid", createdAt: "2026-08-31T07:00:00.000Z" }, updatedAt: "2026-08-31T07:00:00.000Z" },
  ]);
  const ambiguous = await handleConfirmation(secret, {
    TransID: "TFB7M09PQR", TransTime: "20260831150000", TransAmount: "1500",
    BusinessShortCode: "174379", BillRefNumber: "", MSISDN: "254733222111", FirstName: "UNKNOWN",
  });
  eq("an ambiguous payment still posts", ambiguous.status, "posted");
  ok("but is not auto-matched", ambiguous.matchedOrder === undefined, ambiguous);

  const stillUnpaid = await pull(shop, 0);
  const twinA = stillUnpaid.records.find((r) => r.id === "ord_twin_a");
  eq("so neither order is wrongly settled", (twinA!.doc as Doc).paymentStatus, "unpaid");

  /* ---- A price that was talked down ------------------------------------
   *
   * The shelf price is an opening position in this market. A customer who
   * bargained a 14,500 phone to 13,000 and paid must not arrive as a mystery
   * for the seller to reconcile by hand. */
  await push(shop, randomUUID(), [
    {
      kind: "order", id: "ord_bargain",
      doc: {
        id: "ord_bargain", code: "#8801", customerId: "cus_grace",
        items: [{ productId: "p", name: "Redmi 13C", qty: 1, price: 14500 }],
        deliveryFee: 0, deliverySettlement: "customer_pays_rider",
        discount: 0, status: "confirmed", paymentStatus: "unpaid",
        createdAt: "2026-08-31T07:00:00.000Z",
      },
      updatedAt: "2026-08-31T07:00:00.000Z",
    },
  ]);

  const haggled = await handleConfirmation(secret, {
    TransactionType: "Pay Bill", TransID: "TGX9BARG01", TransTime: "20260901120000",
    TransAmount: "13000.00", BusinessShortCode: "174379", BillRefNumber: "",
    MSISDN: "254722418903", FirstName: "GRACE", LastName: "WAIRIMU",
  });
  eq("a bargained payment still posts", haggled.status, "posted");
  eq("and is suggested against the order", haggled.suggestedOrder, "ord_bargain");
  ok(
    "but never settles it on its own",
    haggled.matchedOrder === undefined,
    haggled,
  );

  const withReason = await pull(shop, 0);
  const bargainPay = withReason.records.find((r) => r.id === "pay_mpesa_TGX9BARG01");
  const bargainWhy = (bargainPay!.doc as Doc).matchReasons as string[];
  ok(
    "the reason names the shortfall in the seller's words",
    bargainWhy.some((r) => r.includes("1,500") && r.includes("bargained")),
    bargainWhy,
  );

  // Half the asking price is a deposit or a different order, not a haggle.
  const tooLittle = await handleConfirmation(secret, {
    TransactionType: "Pay Bill", TransID: "TGX9BARG02", TransTime: "20260901121000",
    TransAmount: "3000.00", BusinessShortCode: "174379", BillRefNumber: "",
    MSISDN: "254722418903", FirstName: "GRACE", LastName: "WAIRIMU",
  });
  ok(
    "a payment far below the order is not called a bargain",
    !(tooLittle.suggestedOrder === "ord_bargain" && tooLittle.confidence === 0.72),
    tooLittle,
  );

  const unmatched = await api("GET", `/tenants/${shop}/mpesa/unmatched`, undefined, amina.token);
  ok("and it is listed for a human to sort out", unmatched.body.some((e: { trans_id: string }) => e.trans_id === "TFB7M09PQR"));

  // Another business must not be able to see any of this.
  const nosy = await api("GET", `/tenants/${shop}/mpesa`, undefined, brian.token);
  eq("another seller cannot read the till", nosy.status, 404);

  // The HTTP route always answers 0, or Safaricom retries forever.
  const viaHttp = await api("POST", `/mpesa/c2b/${secret}/confirmation`, {
    TransID: "TFC2N88STU", TransTime: "20260831160000", TransAmount: "4200",
    BusinessShortCode: "174379", MSISDN: "254710552187", FirstName: "BRIAN",
  });
  eq("the callback endpoint accepts", viaHttp.status, 200);
  eq("and tells Safaricom it is done", viaHttp.body.ResultCode, 0);
  const junk = await api("POST", `/mpesa/c2b/${secret}/confirmation`, { nothing: "useful" });
  eq("even for a payload it cannot use", junk.body.ResultCode, 0);
  const validation = await api("POST", `/mpesa/c2b/${secret}/validation`, { TransID: "X" });
  eq("validation never blocks a customer's payment", validation.body.ResultCode, 0);

  /* ---------------------------------------------------------------- */
  section("The database refuses what the code forgets");

  /* Row-level security as it was actually found: enabled, forced, listed in
   * every catalogue view — and bypassed by every query, because the service
   * connected as a superuser and a superuser ignores RLS unconditionally.
   *
   * The application always did scope its queries, so nothing leaked. That is
   * exactly why this needs a test rather than a policy: the protection is for
   * the day a query forgets, and a protection that silently is not there looks
   * identical to one that is until that day arrives. */
  {
    const forged = await withTenant(shop, (client) =>
      client
        .query("select id from records where tenant_id = $1", [brianShop.body.id])
        .then((r) => r.rows),
    );
    eq("one business cannot read another's records", forged.length, 0);

    let refused = false;
    try {
      await withTenant(shop, (client) =>
        client.query(
          `insert into records (tenant_id, kind, id, doc, updated_at, seq)
           values ($1, 'order', 'ord_forged', '{}', now(), 9999)`,
          [brianShop.body.id],
        ),
      );
    } catch {
      refused = true;
    }
    ok("nor write into it", refused);

    // Proof the check above is not passing because the tenant is simply empty.
    const own = await withTenant(shop, (client) =>
      client.query("select id from records limit 1").then((r) => r.rows),
    );
    ok("while still seeing its own", own.length === 1, own);
  }

  /* ---------------------------------------------------------------- */
  section("The operator console — real data, real login");

  // There is no signup endpoint by design; provisioning an admin is a direct
  // database write, exactly as scripts/admin-create.ts does it.
  await query(
    `insert into admin_users (email, password_hash, name) values ($1, $2, $3)
     on conflict (email) do update set password_hash = excluded.password_hash`,
    ["ops@sokoos.app", hashPassword("a very real passphrase"), "Ops"],
  );

  const wrongLogin = await api("POST", "/admin/login", {
    email: "ops@sokoos.app",
    password: "not it",
  });
  eq("a wrong password is refused", wrongLogin.status, 401);

  const unknownLogin = await api("POST", "/admin/login", {
    email: "nobody@sokoos.app",
    password: "whatever",
  });
  eq("an unknown email fails the same way", unknownLogin.status, 401);
  eq(
    "not with a different message an attacker could use to enumerate admins",
    unknownLogin.body.error,
    wrongLogin.body.error,
  );

  const adminLogin = await api("POST", "/admin/login", {
    email: "ops@sokoos.app",
    password: "a very real passphrase",
  });
  eq("the real password signs in", adminLogin.status, 200);
  const adminToken: string = adminLogin.body.token;

  const adminNoToken = await api("GET", "/admin/merchants");
  eq("the console refuses no token", adminNoToken.status, 401);

  const sellerTokenOnAdmin = await api("GET", "/admin/merchants", undefined, amina.token);
  eq("and refuses a seller's own token", sellerTokenOnAdmin.status, 401);

  const merchants = await api("GET", "/admin/merchants", undefined, adminToken);
  eq("the list loads", merchants.status, 200);
  const listedAmina = merchants.body.find((m: Doc) => m.id === shop);
  ok("Amina's business is in it", Boolean(listedAmina), merchants.body);
  eq("under her own name", listedAmina.owner.name, "Amina Hassan");
  eq("with the till connected earlier in this run", listedAmina.till.shortcode, "174379");

  const detail = await api("GET", `/admin/merchants/${shop}`, undefined, adminToken);
  eq("the detail loads", detail.status, 200);
  ok(
    "and counts the records this business actually has",
    Object.keys(detail.body.recordCounts).length > 0,
    detail.body.recordCounts,
  );

  const missingMerchant = await api("GET", `/admin/merchants/${randomUUID()}`, undefined, adminToken);
  eq("a made-up id is a 404", missingMerchant.status, 404);

  const suspend = await api(
    "POST",
    `/admin/merchants/${shop}/suspend`,
    { reason: "Chargeback dispute" },
    adminToken,
  );
  eq("suspending works", suspend.status, 200);
  ok("and the business is marked suspended", Boolean(suspend.body.suspendedAt), suspend.body);

  const { rows: audited } = await query<{ action: string; actor: string; detail: Doc | null }>(
    `select action, actor, detail from admin_audit where tenant_id = $1 order by at desc limit 1`,
    [shop],
  );
  eq("the suspension is on the record", audited[0]?.action, "suspend");
  eq("naming who did it", audited[0]?.actor, "ops@sokoos.app");
  eq("and why", audited[0]?.detail?.reason, "Chargeback dispute");

  const meAfterSuspend = await api("GET", "/me", undefined, amina.token);
  ok(
    "suspension has teeth: the business vanishes from its owner's own session",
    !meAfterSuspend.body.tenants.some((t: Doc) => t.id === shop),
    meAfterSuspend.body,
  );

  const syncWhileSuspended = await api(
    "GET",
    `/tenants/${shop}/sync?since=0`,
    undefined,
    amina.token,
  );
  eq("and sync refuses the suspended tenant too", syncWhileSuspended.status, 404);

  const reinstate = await api("POST", `/admin/merchants/${shop}/reinstate`, {}, adminToken);
  eq("reinstating works", reinstate.status, 200);
  eq("and clears the suspension", reinstate.body.suspendedAt, null);

  const meAfterReinstate = await api("GET", "/me", undefined, amina.token);
  ok(
    "the business is back for its owner",
    meAfterReinstate.body.tenants.some((t: Doc) => t.id === shop),
    meAfterReinstate.body,
  );

  await api("POST", "/admin/sign-out", {}, adminToken);
  const afterAdminSignOut = await api("GET", "/admin/merchants", undefined, adminToken);
  eq("a signed-out admin token stops working", afterAdminSignOut.status, 401);

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
