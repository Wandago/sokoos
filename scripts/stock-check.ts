/** Checks lot allocation, serial tracking and mode-dispatched costing. */
import { createSeedDatabase } from "../lib/seed";
import { costLot, costedLots, lotStockValue } from "../lib/lots";
import { serialisedProducts, underWarranty, serialStockValue } from "../lib/serials";
import { activeStockModes, stockOf, totalStockValue, unitCost } from "../lib/costing";

const db = createSeedDatabase();
let failures = 0;
const expect = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}: ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
};

console.log("stock modes in use:", activeStockModes(db).join(", "));

const bale = costLot(db.lots[0]);
console.log(`\n${bale.lot.reference} — ${bale.lot.name}`);
console.log(` paid ${bale.lot.purchasePrice} + ${bale.extras} extras = ${bale.landedCost} landed, ${bale.units} pieces`);
bale.grades.forEach((g) =>
  console.log(`  ${g.grade.label.padEnd(28)} ${String(g.grade.units).padStart(3)} @ ${String(g.grade.unitPrice).padStart(5)}  cost/unit ${g.costPerUnit.toFixed(2).padStart(8)}  margin ${g.marginPercent.toFixed(0).padStart(3)}%  ${g.remaining} left`),
);
// The whole landed cost must be allocated — no more, no less.
expect("allocated cost equals landed cost", Math.round(bale.grades.reduce((s, g) => s + g.allocatedCost, 0)), Math.round(bale.landedCost));
// Allocating by sales value must give every grade the same margin percentage,
// which is the property that makes the method defensible.
const margins = bale.grades.map((g) => Math.round(g.marginPercent));
expect("by_value gives every grade one margin", new Set(margins).size, 1);
console.log(` recovered ${Math.round(bale.recovered)} of ${bale.landedCost} · paid back: ${bale.paidBack} · ${bale.unitsToBreakEven} more pieces to break even`);
console.log(` projected profit ${Math.round(bale.projectedProfit)}`);

const carton = costLot(db.lots[1]);
expect("even split gives one cost per unit", Math.round(carton.grades[0].costPerUnit), Math.round(carton.landedCost / carton.units));

console.log("\nserialised products:");
serialisedProducts(db).forEach(({ product, summary }) =>
  console.log(` ${product.name.padEnd(24)} ${summary.inStock.length} in stock, ${summary.sold.length} sold, ${summary.faulty.length} faulty  avg cost ${summary.averageCost?.toFixed(0) ?? "—"}  dead stock ${summary.deadStock}`),
);
const powerBank = db.products.find((p) => p.id === "prd_19")!;
expect("serial stock is counted, not typed", stockOf(powerBank, db), 2);
console.log(" under warranty:", underWarranty(db).map((r) => `${r.unit.serial} (${r.warranty.daysLeft}d)`).join(", ") || "none");

console.log("\ncost basis by mode:");
["prd_1", "prd_13", "prd_16", "prd_19"].forEach((id) => {
  const product = db.products.find((p) => p.id === id)!;
  const c = unitCost(product, db);
  console.log(` ${product.name.padEnd(26)} ${c.mode.padEnd(7)} cost ${c.cost === null ? "—" : c.cost.toFixed(0).padStart(6)}  margin ${c.marginPercent === null ? "—" : `${c.marginPercent.toFixed(0)}%`}\n    basis: ${c.basis}`);
});

console.log(`\nstock value: ingredients+lots+serials+simple = ${Math.round(totalStockValue(db))}`);
console.log(` of which lots ${Math.round(lotStockValue(db))}, serials ${Math.round(serialStockValue(db))}`);
console.log(`\nlots not yet paid back: ${costedLots(db).filter((l) => !l.paidBack).map((l) => l.lot.reference).join(", ") || "none"}`);

console.log(failures ? `\n${failures} FAILURES` : "\nall assertions pass");
process.exit(failures ? 1 : 0);
