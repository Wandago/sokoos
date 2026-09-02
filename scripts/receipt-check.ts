/**
 * Checks what a receipt claims.
 *
 * A receipt is the one artefact a seller hands to somebody else, so the things
 * worth testing are the things a customer could be misled by: a code presented
 * as checkable when it is not, a boda fare receipted as business income, and a
 * receipt issued for money that has not arrived.
 */
import { createSeedDatabase } from "../lib/seed";
import {
  buildReceipt,
  looksLikeMpesaCode,
  receiptText,
  receiptable,
  totalSpent,
} from "../lib/receipts";
import type { Database, Order, Payment } from "../lib/types";

let failures = 0;
const expect = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${label}: ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`,
  );
};
const check = (label: string, ok: boolean, detail?: unknown) => {
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok || detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
};

const base = createSeedDatabase();

const order = (settlement: Order["deliverySettlement"], overrides: Partial<Order> = {}): Order => ({
  id: "ord_r1",
  code: "#R1",
  customerId: "cus_r1",
  items: [{ productId: "p", name: "Ankara wrap dress", qty: 1, price: 2200 }],
  deliveryFee: 200,
  deliverySettlement: settlement,
  discount: 0,
  status: "confirmed",
  paymentStatus: "paid",
  channel: "instagram",
  address: "Westlands",
  createdAt: "2026-09-01T07:00:00.000Z",
  ...overrides,
});

const payment = (overrides: Partial<Payment> = {}): Payment => ({
  id: "pay_r1",
  orderId: "ord_r1",
  customerId: "cus_r1",
  customerName: "Grace Wairimu",
  method: "mpesa",
  amount: 2200,
  reference: "TFA4K21LMN",
  state: "received",
  receivedAt: "2026-09-01T08:12:00.000Z",
  matched: true,
  source: "mpesa",
  ...overrides,
});

const world = (o: Order, p: Payment): Database => ({
  ...base,
  business: { ...base.business, name: "Zawadi Collection", tillNumber: "5240119" },
  customers: [
    {
      ...base.customers[0]!,
      id: "cus_r1",
      name: "Grace Wairimu",
      phone: "0722418903",
    },
  ],
  orders: [o],
  payments: [p],
});

console.log("\nthe code is the receipt number\n");

{
  const r = buildReceipt(world(order("customer_pays_rider"), payment()), payment());
  expect("an M-Pesa code becomes the receipt number", r.number, "TFA4K21LMN");
  check("and is marked as the transaction code itself", r.numberIsTransactionCode);
  check("so the customer is told what to compare it against", r.proof.checkable);
  check("naming the amount", r.proof.line.includes("2,200"), r.proof.line);
  check("and the till it went to", r.proof.line.includes("5240119"), r.proof.line);
}

console.log("\nnothing is dressed up as a code it is not\n");

check("a real code is recognised", looksLikeMpesaCode("TFA4K21LMN"));
check("lower case is still a code", looksLikeMpesaCode("tfa4k21lmn"));
check("an order number is not", !looksLikeMpesaCode("7788"));
check("nor a note", !looksLikeMpesaCode("paid on friday"));
check("nor something merely code-shaped but short", !looksLikeMpesaCode("TFA4K21"));

{
  // A seller typing "sent it" where a code should be must not produce a
  // receipt telling the customer to go and check for "sent it".
  const p = payment({ reference: "sent it" });
  const r = buildReceipt(world(order("customer_pays_rider"), p), p);
  check("a reference that is not a code is not checkable", !r.proof.checkable);
  check("the receipt number is plainly ours, not Safaricom's", r.number.startsWith("SK-"), r.number);
  check("and never repeats the fake reference as proof", !r.proof.checkable && r.number !== "sent it");
  check(
    "the receipt says whose record it is",
    r.proof.line.includes("seller's own record"),
    r.proof.line,
  );
}

{
  const p = payment({ method: "cash", reference: "", id: "pay_cash" });
  const r = buildReceipt(world(order("customer_pays_rider"), p), p);
  check("cash is honest about having nothing to check", !r.proof.checkable);
  check("and says so in words", r.proof.line.includes("no transaction code"), r.proof.line);
  check("the number is stable and ours", /^SK-[0-9A-Z]{8}$/.test(r.number), r.number);
}

{
  // The same payment must produce the same number every time it is reprinted.
  const p = payment({ method: "cash", reference: "", id: "pay_cash" });
  const a = buildReceipt(world(order("customer_pays_rider"), p), p);
  const b = buildReceipt(world(order("customer_pays_rider"), p), p);
  expect("reprinting gives the same number", a.number, b.number);

  const other = payment({ method: "cash", reference: "", id: "pay_cash_2" });
  check("a different payment gets a different one", buildReceipt(world(order("customer_pays_rider"), other), other).number !== a.number);
}

console.log("\nthe boda's fare is not the seller's income\n");

{
  const o = order("customer_pays_rider");
  const r = buildReceipt(world(o, payment()), payment());
  expect("the receipt totals only the goods", r.total, 2200);
  expect("the fare is shown, marked as the rider's", r.riderPaidSeparately, 200);
  expect("and is not charged by the business", r.deliveryCharged, 0);
  expect("what the customer actually spent still adds up", totalSpent(r), 2400);
  check(
    "the message says the fare was paid to the rider",
    receiptText(r).includes("paid directly to the rider"),
    receiptText(r),
  );
}

{
  const o = order("business_pays_rider");
  const p = payment({ amount: 2400 });
  const r = buildReceipt(world(o, p), p);
  expect("when the business charges delivery, it is on the receipt", r.deliveryCharged, 200);
  expect("and the total includes it", r.total, 2400);
  expect("with nothing owed to the rider by the customer", r.riderPaidSeparately, 0);
  expect("and nothing outstanding", r.balance, 0);
}

console.log("\na receipt is only for money that arrived\n");

check("a received payment can be receipted", receiptable(payment()));
check("a pending one cannot", !receiptable(payment({ state: "pending" })));
check("nor a failed one", !receiptable(payment({ state: "failed" })));
check("nor one still under review", !receiptable(payment({ state: "review" })));

console.log("\npart payment says what is still owed\n");

{
  const o = order("business_pays_rider");
  const p = payment({ amount: 1000 });
  const r = buildReceipt(world(o, p), p);
  expect("the receipt shows what was paid", r.paid, 1000);
  expect("and what is left", r.balance, 1400);
  check("the message says so too", receiptText(r).includes("Balance still due"), receiptText(r));
}

console.log("\na payment with no order behind it still receipts\n");

{
  const p = payment({ orderId: undefined, amount: 750, id: "pay_loose" });
  const db = { ...world(order("customer_pays_rider"), p), orders: [] };
  const r = buildReceipt(db, p);
  expect("one line, for the amount", r.lines.length, 1);
  expect("and it is the amount", r.lines[0]!.total, 750);
  expect("the total is the payment", r.total, 750);
  check("with no order number invented", r.orderCode === undefined);
}

console.log("\na price that was bargained down\n");

{
  const o = order("customer_pays_rider", {
    items: [{ productId: "p", name: "Redmi 13C", qty: 1, price: 13000, listPrice: 14500 }],
  });
  const p = payment({ amount: 13000 });
  const r = buildReceipt(world(o, p), p);

  expect("the receipt totals what was agreed", r.total, 13000);
  expect("and shows what came off", r.bargained, 1500);
  expect("with the asking price on the line", r.lines[0]!.listPrice, 14500);
  check("the message says what they saved", receiptText(r).includes("You saved"), receiptText(r));
  // The proof line quotes the amount that actually moved, not the shelf price.
  check("and the code checks against the paid amount", r.proof.line.includes("13,000"), r.proof.line);
}

{
  // Sold at the asking price: no saving line, no struck-through number.
  const r = buildReceipt(world(order("customer_pays_rider"), payment()), payment());
  expect("nothing saved when nothing was bargained", r.bargained, 0);
  check("and no asking price on the line", r.lines[0]!.listPrice === undefined);
  check("nor in the message", !receiptText(r).includes("You saved"));
}

console.log("\nthe message a customer receives\n");

{
  const r = buildReceipt(world(order("customer_pays_rider"), payment()), payment());
  const text = receiptText(r);
  check("names the business", text.includes("Zawadi Collection"), text);
  check("carries the code", text.includes("TFA4K21LMN"));
  check("says what was bought", text.includes("Ankara wrap dress"));
  check("and how it was paid", text.includes("M-Pesa"));
  console.log("\n" + text + "\n");
}

console.log(failures ? `${failures} FAILURES` : "all assertions pass");
process.exit(failures ? 1 : 0);
