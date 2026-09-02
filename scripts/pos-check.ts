/**
 * Checks the till.
 *
 * A counter sale is final the moment the customer walks away, so these are the
 * sums that have to be right in front of somebody waiting: change from a note,
 * what is still owed on a short payment, and whether the shop can actually hand
 * over what has been rung up.
 */
import { createSeedDatabase } from "../lib/seed";
import {
  blockers,
  cartTotals,
  cashOutcome,
  canSell,
  sellableCount,
  tenderSuggestions,
  tillToday,
  toOrderItems,
} from "../lib/pos";
import type { CartLine } from "../lib/pos";
import type { Database, Product } from "../lib/types";

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
  console.log(
    `${ok ? "ok  " : "FAIL"} ${label}${ok || detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`,
  );
};

const base = createSeedDatabase();

/* Built from a real seeded product so every required field is present, and so
 * this check keeps compiling when the Product shape grows. */
const product = (over: Partial<Product> = {}): Product => ({
  ...base.products[0]!,
  id: "prd_x",
  name: "Mandazi",
  category: "Snacks",
  price: 250,
  cost: 66,
  stock: 5,
  lowStockAt: 2,
  active: true,
  stockMode: "simple",
  ...over,
});

const world = (products: Product[], over: Partial<Database> = {}): Database => ({
  ...base,
  products,
  serials: [],
  orders: [],
  payments: [],
  ...over,
});

console.log("\nthe bill\n");

{
  const lines: CartLine[] = [
    { productId: "a", name: "Mandazi", price: 250, qty: 2 },
    { productId: "b", name: "Soda", price: 80, qty: 3 },
  ];
  const t = cartTotals(lines);
  expect("counts things, not lines", t.count, 5);
  expect("adds up", t.goods, 740);
  expect("with no discount, total is the goods", t.total, 740);

  expect("a discount comes off", cartTotals(lines, 40).total, 700);
  // A shopkeeper thumbing a discount field must not be able to invent a refund.
  expect("a discount cannot exceed the bill", cartTotals(lines, 9999).total, 0);
  expect("nor go negative", cartTotals(lines, -50).discount, 0);
  expect("an empty cart is zero, not NaN", cartTotals([]).total, 0);
}

console.log("\nchange from a note\n");

expect("exact money leaves nothing to hand back", cashOutcome(740, 740), {
  change: 0,
  short: 0,
  enough: true,
});
expect("a thousand for a 740 bill", cashOutcome(740, 1000).change, 260);
expect("and it is settled", cashOutcome(740, 1000).enough, true);

{
  // Part payment is ordinary here; the till reports it rather than refusing.
  const short = cashOutcome(740, 500);
  expect("a short payment says what is left", short.short, 240);
  expect("and hands back nothing", short.change, 0);
  check("and is not treated as settled", !short.enough);
}

console.log("\nnotes a customer is likely to hand over\n");

{
  const s = tenderSuggestions(740);
  check("the exact amount is always offered", s.includes(740), s);
  check("so is the note that covers it", s.includes(1000), s);
  check("every suggestion covers the bill", s.every((n) => n >= 740), s);
  console.log(`     740 → ${s.join(", ")}`);

  const small = tenderSuggestions(250);
  check("small bills suggest small notes", small.includes(500), small);
  console.log(`     250 → ${small.join(", ")}`);
  expect("nothing to suggest for an empty cart", tenderSuggestions(0), []);
}

console.log("\nwhat the shop can actually hand over\n");

{
  const db = world([product({ stock: 3 })]);
  const p = db.products[0]!;
  expect("stock is what stock says", sellableCount(db, p), 3);
  check("the first one is fine", canSell(db, p, 0).ok);
  check("so is the third", canSell(db, p, 2).ok);

  const blocked = canSell(db, p, 3);
  check("the fourth is not", !blocked.ok);
  check(
    "and it says how many there are",
    !blocked.ok && blocked.message.includes("3"),
    !blocked.ok && blocked.message,
  );
}

{
  const db = world([product({ stock: 0 })]);
  const out = canSell(db, db.products[0]!, 0);
  check("nothing sells at zero stock", !out.ok);
  check("and it says so plainly", !out.ok && out.reason === "out_of_stock");
}

{
  // A service has no stock to run out of — a barber can cut all day.
  const db = world([product({ stockMode: "service", stock: 0, name: "Haircut" })]);
  check("a service always sells", canSell(db, db.products[0]!, 99).ok);
  // Compared directly: JSON.stringify turns Infinity into null, so an
  // expect() here would pass even if the function returned nothing at all.
  check("and has no countable stock", sellableCount(db, db.products[0]!) === Infinity);
}

console.log("\nserialised stock is counted from the units\n");

{
  const phone = product({ id: "prd_phone", name: "Redmi 13C", stockMode: "serial", stock: 99 });
  const db = world([phone], {
    serials: [
      { id: "s1", productId: "prd_phone", serial: "356938035643809", cost: 11000, status: "in_stock", receivedAt: "2026-08-01T00:00:00.000Z" },
      { id: "s2", productId: "prd_phone", serial: "356938035643810", cost: 11000, status: "in_stock", receivedAt: "2026-08-01T00:00:00.000Z" },
      { id: "s3", productId: "prd_phone", serial: "356938035643811", cost: 11000, status: "sold", receivedAt: "2026-08-01T00:00:00.000Z" },
    ],
  });

  // The number typed on the product says 99. Only two handsets are in the shop.
  expect("the tally on the product is ignored", sellableCount(db, phone), 2);
  check("two can go in the cart", canSell(db, phone, 1).ok);
  check("a third cannot", !canSell(db, phone, 2).ok);

  expect(
    "and a sale with no handset chosen is refused",
    blockers(db, [{ productId: "prd_phone", name: "Redmi 13C", price: 14500, qty: 1 }]),
    ["Choose which Redmi 13C is leaving — 0 of 1 picked."],
  );
  expect(
    "with the handset named, it goes through",
    blockers(db, [
      { productId: "prd_phone", name: "Redmi 13C", price: 14500, qty: 1, serialIds: ["s1"] },
    ]),
    [],
  );
  expect(
    "two ordered but one picked is still short",
    blockers(db, [
      { productId: "prd_phone", name: "Redmi 13C", price: 14500, qty: 2, serialIds: ["s1"] },
    ]),
    ["Choose which Redmi 13C units are leaving — 1 of 2 picked."],
  );
}

console.log("\nevery problem at once, not one at a time\n");

{
  const db = world([
    product({ id: "a", name: "Mandazi", stock: 1 }),
    product({ id: "b", name: "Soda", stock: 0 }),
  ]);
  const problems = blockers(db, [
    { productId: "a", name: "Mandazi", price: 250, qty: 3 },
    { productId: "b", name: "Soda", price: 80, qty: 2 },
    { productId: "gone", name: "Chapati", price: 30, qty: 1 },
  ]);
  expect("all three are reported together", problems.length, 3);
  check("including a product that was deleted", problems.some((p) => p.includes("Chapati")), problems);
}

console.log("\nthe cart becomes order lines\n");

{
  const lines: CartLine[] = [
    { productId: "a", name: "Mandazi", price: 250, qty: 2, serialIds: ["s1"] },
  ];
  expect("carrying only what an order needs", toOrderItems(lines), [
    { productId: "a", name: "Mandazi", qty: 2, price: 250 },
  ]);
}

console.log("\nthe day at the till\n");

{
  const today = new Date("2026-09-02T15:00:00.000Z");
  const db = world([product()], {
    orders: [
      {
        id: "ord_1", code: "#1", customerId: "", items: [{ productId: "a", name: "Mandazi", qty: 2, price: 250 }],
        deliveryFee: 0, discount: 0, status: "delivered", paymentStatus: "paid", channel: "walk-in",
        address: "", createdAt: "2026-09-02T09:00:00.000Z",
      },
      {
        id: "ord_2", code: "#2", customerId: "", items: [{ productId: "a", name: "Soda", qty: 1, price: 80 }],
        deliveryFee: 0, discount: 0, status: "delivered", paymentStatus: "unpaid", channel: "walk-in",
        address: "", createdAt: "2026-09-02T10:00:00.000Z",
      },
      // An Instagram order the same day: not the till's takings.
      {
        id: "ord_3", code: "#3", customerId: "", items: [{ productId: "a", name: "Dress", qty: 1, price: 2200 }],
        deliveryFee: 200, discount: 0, status: "delivered", paymentStatus: "paid", channel: "instagram",
        address: "Westlands", createdAt: "2026-09-02T11:00:00.000Z",
      },
    ],
    payments: [
      { id: "p1", orderId: "ord_1", customerName: "Walk-in customer", method: "cash", amount: 300, reference: "", state: "received", receivedAt: "2026-09-02T09:00:00.000Z", matched: true, source: "manual" },
      { id: "p2", orderId: "ord_1", customerName: "Walk-in customer", method: "mpesa", amount: 200, reference: "TFA4K21LMN", state: "received", receivedAt: "2026-09-02T09:01:00.000Z", matched: true, source: "manual" },
      { id: "p3", orderId: "ord_3", customerName: "Grace", method: "mpesa", amount: 2200, reference: "TFB1K21LMN", state: "received", receivedAt: "2026-09-02T11:00:00.000Z", matched: true, source: "manual" },
    ],
  });

  const day = tillToday(db, today);
  expect("counter sales are counted", day.sales, 2);
  expect("takings are the counter's own", day.takings, 500);
  // Kept apart because they are reconciled apart: a drawer and a statement.
  expect("cash on its own", day.cash, 300);
  expect("M-Pesa on its own", day.mpesa, 200);
  expect("and goods handed over unpaid are still owed", day.owed, 80);
}

console.log(failures ? `\n${failures} FAILURES` : "\nall assertions pass");
process.exit(failures ? 1 : 0);
