/**
 * End to end: a real server, a real Postgres, and two devices.
 *
 * The unit tests prove each half. This proves the halves fit — that a seller
 * who already has months of records in their browser can sign in, keep them,
 * and see them appear on a second phone.
 *
 * Needs: the API running, DATABASE_URL set. See server/README.md.
 */
import { randomUUID } from "node:crypto";
import { createSeedDatabase } from "../lib/seed";
import { applyPulled, diffOps, snapshotOps, type PulledRecord } from "../lib/sync/records";
import type { Database } from "../lib/types";

const API = process.env.API_URL ?? "http://127.0.0.1:8787";
let failures = 0;
const expect = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}: ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
};
const check = (label: string, condition: boolean, detail?: unknown) => {
  if (!condition) failures++;
  console.log(`${condition ? "ok  " : "FAIL"} ${label}${condition || detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
};

async function call(path: string, init: RequestInit = {}, token?: string) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function pushAll(tenantId: string, token: string, ops: unknown[], device: string) {
  let pushed = 0;
  for (let i = 0; i < ops.length; i += 400) {
    const chunk = ops.slice(i, i + 400);
    const r = await call(
      `/tenants/${tenantId}/sync`,
      { method: "POST", body: JSON.stringify({ batchId: randomUUID(), deviceId: device, ops: chunk }) },
      token,
    );
    pushed += r.applied;
  }
  return pushed;
}

async function pullAll(tenantId: string, token: string, since = 0) {
  const all: PulledRecord[] = [];
  let cursor = since;
  for (let page = 0; page < 50; page++) {
    const r = await call(`/tenants/${tenantId}/sync?since=${cursor}`, {}, token);
    all.push(...r.records);
    cursor = r.cursor;
    if (!r.more) break;
  }
  return { records: all, cursor };
}

async function main() {
  const health = await call("/health");
  check("the server is up", health.ok === true);

  const phone = `07${String(Math.floor(Math.random() * 90_000_000) + 10_000_000)}`;
  const asked = await call("/auth/code", { method: "POST", body: JSON.stringify({ phone }) });
  const session = await call("/auth/verify", {
    method: "POST",
    body: JSON.stringify({ phone, code: asked.devCode, name: "Louis Wandago" }),
  });
  check("a seller signs in with a code", typeof session.token === "string");

  const shop = await call(
    "/tenants",
    { method: "POST", body: JSON.stringify({ name: "Zawadi Collection", industry: "fashion" }) },
    session.token,
  );
  console.log(` shop created: ${shop.name} at /${shop.slug}`);

  /* Device one already has the whole business in its browser — that is the
   * situation any real pilot user is in, and the one worth getting right. */
  const local = createSeedDatabase();
  const snapshot = snapshotOps(local, "2026-08-31T08:00:00.000Z");
  console.log(`\n device one holds ${snapshot.length} records; pushing…`);
  const started = Date.now();
  const applied = await pushAll(shop.id, session.token, snapshot, "phone-a");
  expect("everything already on the phone reaches the server", applied, snapshot.length);
  console.log(` pushed ${applied} records in ${Date.now() - started}ms`);

  /* Device two is a fresh browser: empty, then filled from the server. */
  const fresh: Database = {
    ...createSeedDatabase(),
    customers: [], products: [], orders: [], payments: [], riders: [],
    deliveries: [], ledger: [], conversations: [], captures: [],
    ingredients: [], services: [], staff: [], lots: [], serials: [], imports: [],
  };
  const pulled = await pullAll(shop.id, session.token);
  const deviceTwo = applyPulled(fresh, pulled.records);
  console.log(`\n device two pulled ${pulled.records.length} records`);

  expect("orders arrive intact", deviceTwo.orders.length, local.orders.length);
  expect("ledger entries too", deviceTwo.ledger.length, local.ledger.length);
  expect("and services", deviceTwo.services.length, local.services.length);
  expect("and the bale", deviceTwo.lots.length, local.lots.length);
  expect("the business name travelled", deviceTwo.business.name, local.business.name);
  expect("so did the storefront", deviceTwo.storefront.slug, local.storefront.slug);

  // The thing that actually matters: the money is byte-identical after a trip
  // through JSON, Postgres jsonb and back.
  const localTotal = local.ledger.reduce((s, e) => s + e.amount, 0);
  const remoteTotal = deviceTwo.ledger.reduce((s, e) => s + e.amount, 0);
  expect("not one shilling changed in transit", remoteTotal, localTotal);
  /* Postgres jsonb normalises key order, so a byte comparison would fail for a
   * reason that means nothing. What must hold is that every field and value
   * survives — so both sides are canonicalised before comparing. */
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => [k, canonical(v)]),
          )
        : value;

  const sample = local.orders[0]!;
  const echoed = deviceTwo.orders.find((o) => o.id === sample.id)!;
  check(
    "an order survives field for field",
    JSON.stringify(canonical(echoed)) === JSON.stringify(canonical(sample)),
  );
  check(
    "and every record does",
    local.orders.every((o) => {
      const there = deviceTwo.orders.find((x) => x.id === o.id);
      return there && JSON.stringify(canonical(there)) === JSON.stringify(canonical(o));
    }),
  );

  /* Now device one makes a change and device two picks it up — the whole point
   * of having a server at all. */
  console.log("\n device one edits an order, device two syncs:");
  const edited: Database = {
    ...local,
    orders: local.orders.map((o, i) => (i === 0 ? { ...o, note: "Left at the gate" } : o)),
    products: local.products.filter((_, i) => i !== 0),
  };
  const delta = diffOps(local, edited, "2026-08-31T09:00:00.000Z");
  expect("only the difference is sent", delta.length, 2);
  await pushAll(shop.id, session.token, delta, "phone-a");

  const second = await pullAll(shop.id, session.token, pulled.cursor);
  expect("device two receives just those two", second.records.length, 2);
  const settled = applyPulled(deviceTwo, second.records);
  expect("the note arrived", settled.orders.find((o) => o.id === local.orders[0]!.id)?.note, "Left at the gate");
  expect("and the deleted product is gone", settled.products.length, local.products.length - 1);

  // A retry of a batch already delivered must change nothing.
  const replayId = randomUUID();
  const send = () =>
    call(
      `/tenants/${shop.id}/sync`,
      { method: "POST", body: JSON.stringify({ batchId: replayId, deviceId: "phone-a", ops: delta }) },
      session.token,
    );
  const first = await send();
  const again = await send();
  check("the same batch id twice is recognised as a replay", again.replayed === true);
  expect("and does not move the cursor", again.cursor, first.cursor);

  // And the public site is readable by someone with no account at all.
  const publicView = await call(`/store/${shop.slug}`);
  check("the mini site is public", publicView.business.slug === shop.slug);
  console.log(` /store/${shop.slug} serves ${publicView.products.length} products to anyone`);

  const summary = await call(`/tenants/${shop.id}/summary`, {}, session.token);
  console.log("\n stored on the server:", Object.entries(summary).map(([k, v]) => `${k} ${v}`).join(", "));

  console.log(failures ? `\n${failures} FAILURES` : "\nall assertions pass");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
