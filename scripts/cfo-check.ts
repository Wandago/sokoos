/** Sanity-checks the CFO brief against the seeded books. */
import { createSeedDatabase } from "../lib/seed";
import { cashPosition, cfoFindings, coverage, costPerShilling, expenseMix } from "../lib/cfo";

const db = createSeedDatabase();
const cash = cashPosition(db);
console.log("income:", Math.round(cash.income), "expenses:", Math.round(cash.expenses), "net:", Math.round(cash.net));
console.log("burn/day:", Math.round(cash.burnPerDay), "cushion days:", Math.round(cash.cushionDays));
const c = coverage(db);
console.log("coverage:", `${c.reconciled}/${c.entries} = ${c.percent.toFixed(1)}%`, "loose:", Math.round(c.loose));
console.log("cost per shilling:", costPerShilling(db));
console.log("\ntop expense categories:");
expenseMix(db).slice(0, 5).forEach((l) =>
  console.log(` ${l.category.padEnd(16)} ${String(Math.round(l.amount)).padStart(8)}  ${l.share.toFixed(0)}%  ${l.delta >= 0 ? "+" : ""}${l.delta.toFixed(0)}%`),
);
console.log("\nfindings:");
cfoFindings(db).forEach((f) => console.log(` [${f.severity}] ${f.title} — ${f.figure}\n    ${f.body}\n    workings: ${f.workings}`));

import { costedProducts } from "../lib/costing";
console.log("\ncosted products:");
costedProducts(db).forEach(({ product, cost }) =>
  console.log(` ${product.name.padEnd(26)} price ${String(product.price).padStart(5)}  cost ${String(Math.round(cost.unitCost)).padStart(5)}  margin ${cost.marginPercent.toFixed(0)}%  makeable ${cost.makeable}  limited by ${cost.limitedBy?.name ?? "—"}`),
);
