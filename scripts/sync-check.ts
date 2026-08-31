/**
 * The client half of sync: what gets sent, and what happens when it comes back.
 * Pure functions, so this needs no browser and no server.
 */
import { createSeedDatabase } from "../lib/seed";
import { applyPulled, diffOps, snapshotOps, COLLECTIONS } from "../lib/sync/records";
import type { Database } from "../lib/types";

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

const db = createSeedDatabase();

console.log("A whole business, as records:");
const snapshot = snapshotOps(db, "2026-08-31T10:00:00.000Z");
const kinds = new Set(snapshot.map((op) => op.kind));
console.log(` ${snapshot.length} records across ${kinds.size} kinds`);
check("every collection is represented", COLLECTIONS.every((c) => (db[c] as unknown[]).length === 0 || snapshot.some((op) => op.doc && (db[c] as { id: string }[]).some((r) => r.id === op.id))));
check("the business record is included", snapshot.some((op) => op.kind === "business"));
check("the storefront is included", snapshot.some((op) => op.kind === "storefront"));
check("every op carries a timestamp", snapshot.every((op) => Boolean(op.updatedAt)));
check("and none is a tombstone", snapshot.every((op) => !op.deleted));

console.log("\nOnly what changed is sent:");
// The store updates immutably, which is what makes a reference diff correct.
const edited: Database = {
  ...db,
  orders: db.orders.map((o, i) => (i === 0 ? { ...o, note: "Call before delivery" } : o)),
};
const one = diffOps(db, edited, "2026-08-31T11:00:00.000Z");
expect("editing one order sends one op", one.length, 1);
expect("and it is that order", one[0]?.id, db.orders[0]!.id);
check("untouched collections send nothing", !one.some((op) => op.kind !== "order"));

const untouched = diffOps(db, { ...db }, "2026-08-31T11:00:00.000Z");
expect("a no-op change sends nothing", untouched.length, 0);

const added: Database = {
  ...db,
  products: [{ ...db.products[0]!, id: "prd_new", name: "New thing" }, ...db.products],
};
const withAdd = diffOps(db, added);
expect("adding a product sends one op", withAdd.length, 1);
expect("as an upsert, not a delete", withAdd[0]?.deleted, undefined);

const removed: Database = { ...db, products: db.products.slice(1) };
const withDelete = diffOps(db, removed);
expect("removing a product sends one op", withDelete.length, 1);
check("as a tombstone", withDelete[0]?.deleted === true);
expect("naming the record that went", withDelete[0]?.id, db.products[0]!.id);
check("and carrying no document with it", withDelete[0]?.doc === undefined);

console.log("\nWhat comes back from another device:");
const pulled = applyPulled(db, [
  { kind: "order", id: "ord_from_phone_2", doc: { id: "ord_from_phone_2", code: "#99", items: [] }, updatedAt: "2026-08-31T12:00:00.000Z", deleted: false, seq: 1 },
  { kind: "product", id: db.products[0]!.id, doc: { ...db.products[0]!, price: 9999 }, updatedAt: "2026-08-31T12:00:00.000Z", deleted: false, seq: 2 },
  { kind: "customer", id: db.customers[0]!.id, doc: null, updatedAt: "2026-08-31T12:00:00.000Z", deleted: true, seq: 3 },
]);
expect("a new order arrives", pulled.orders.length, db.orders.length + 1);
expect("an edit is applied", pulled.products.find((p) => p.id === db.products[0]!.id)?.price, 9999);
expect("a delete removes the record", pulled.customers.length, db.customers.length - 1);
check("collections nobody touched keep their identity", pulled.ledger === db.ledger);
check("but the ones that changed do not", pulled.products !== db.products);

check("an empty pull returns the very same object", applyPulled(db, []) === db);
const unknownKind = applyPulled(db, [
  { kind: "something_from_a_newer_build", id: "x", doc: { a: 1 }, updatedAt: "2026-08-31T12:00:00.000Z", deleted: false, seq: 4 },
]);
check("an unknown kind is ignored rather than crashing", unknownKind === db);

console.log("\nA full round trip, two devices:");
// Phone A edits, the ops travel, phone B applies them and ends up identical.
const phoneA: Database = {
  ...db,
  orders: db.orders.map((o, i) => (i === 0 ? { ...o, status: "delivered" as const } : o)),
  products: db.products.filter((_, i) => i !== 2),
};
const ops = diffOps(db, phoneA, "2026-08-31T13:00:00.000Z");
const phoneB = applyPulled(db, ops.map((op, i) => ({
  kind: op.kind, id: op.id, doc: op.doc ?? null,
  updatedAt: op.updatedAt, deleted: Boolean(op.deleted), seq: i + 1,
})));
expect("the edited order arrived", phoneB.orders.find((o) => o.id === db.orders[0]!.id)?.status, "delivered");
expect("the deleted product is gone", phoneB.products.length, phoneA.products.length);
check("and the product really is the right one", !phoneB.products.some((p) => p.id === db.products[2]!.id));

console.log(failures ? `\n${failures} FAILURES` : "\nall assertions pass");
process.exit(failures ? 1 : 0);
