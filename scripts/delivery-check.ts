/**
 * Checks that the delivery fee lands in the right place — or nowhere at all.
 * This is the arithmetic that decides whether a seller's revenue is real.
 */
import { createSeedDatabase } from "../lib/seed";
import {
  customerPays,
  feesPaidDirectToRiders,
  goodsTotal,
  riderFloat,
  riderFloatByRider,
  riderOwed,
  sellerReceives,
  settlementOf,
} from "../lib/selectors";
import type { Order } from "../lib/types";

const db = createSeedDatabase();
let failures = 0;
const expect = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}: ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
};

const order = (settlement: Order["deliverySettlement"]): Order => ({
  id: "ord_test",
  code: "#T",
  customerId: "cus_1",
  items: [{ productId: "p", name: "Dress", qty: 1, price: 500 }],
  deliveryFee: 200,
  deliverySettlement: settlement,
  discount: 0,
  status: "new",
  paymentStatus: "unpaid",
  channel: "tiktok",
  address: "Westlands",
  createdAt: new Date().toISOString(),
});

/* The scenario the whole thing turns on: a customer sees a dress on TikTok,
 * calls, and is told it is 500. They are in Westlands, so the boda is 200 on
 * top — paid to the rider, not the seller. The seller earned 500. */
console.log("A KES 500 dress delivered to Westlands for KES 200:\n");
const cases: [NonNullable<Order["deliverySettlement"]>, number, number, number][] = [
  // settlement, customer pays, seller receives, seller owes the rider
  ["customer_pays_rider", 700, 500, 0],
  ["business_pays_rider", 700, 700, 200],
  ["rider_collects", 700, 700, 0],
  ["free", 500, 500, 200],
];
for (const [settlement, pays, receives, owed] of cases) {
  const o = order(settlement);
  console.log(` ${settlement}`);
  expect("   customer pays", customerPays(o), pays);
  expect("   seller receives", sellerReceives(o), receives);
  expect("   seller owes the rider", riderOwed(o), owed);
}

expect("goods total ignores the trip entirely", goodsTotal(order("business_pays_rider")), 500);
expect(
  "an order written before settlement existed still behaves as it did",
  sellerReceives({ ...order("customer_pays_rider"), deliverySettlement: undefined }),
  700,
);
expect("and reads as the seller settling it", settlementOf({ ...order("free"), deliverySettlement: undefined }), "business_pays_rider");

console.log("\nAgainst the seeded books:");
const bySettlement = new Map<string, number>();
db.orders.forEach((o) => bySettlement.set(settlementOf(o), (bySettlement.get(settlementOf(o)) ?? 0) + 1));
console.log(" orders by settlement:", [...bySettlement].map(([k, v]) => `${k} ${v}`).join(", "));

const float = riderFloat(db);
console.log(` rider float: ${Math.round(float)} across ${riderFloatByRider(db).length} rider(s)`);
const holders = riderFloatByRider(db);
expect("float equals the sum of what each rider holds", Math.round(float), Math.round(holders.reduce((s, h) => s + h.amount, 0)));
expect("every unremitted delivery is counted", db.deliveries.filter((d) => d.cashCollected && !d.remittedAt).length, holders.reduce((n, h) => n + h.trips, 0));

// A fee the seller never touched must never appear in their ledger.
const passedThrough = feesPaidDirectToRiders(db);
console.log(` fees customers paid riders directly, last 30 days: ${Math.round(passedThrough)}`);
const riderExpenses = db.ledger
  .filter((e) => e.type === "expense" && e.category === "Delivery")
  .reduce((sum, e) => sum + e.amount, 0);
const sellerSettled = db.orders
  .filter((o) => settlementOf(o) === "business_pays_rider" && o.status !== "cancelled")
  .reduce((sum, o) => sum + o.deliveryFee, 0);
console.log(` delivery expense in the ledger: ${Math.round(riderExpenses)}`);
console.log(` fees the seller actually settles: ${Math.round(sellerSettled)}`);
expect(
  "the ledger never charges the seller for a trip they did not pay for",
  riderExpenses <= sellerSettled,
  true,
);

console.log(failures ? `\n${failures} FAILURES` : "\nall assertions pass");
process.exit(failures ? 1 : 0);
