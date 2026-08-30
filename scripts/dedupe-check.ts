/**
 * Verifies the statement duplicate detection against the seeded books.
 * Run with: npx tsx scripts/dedupe-check.ts
 */
import { parseStatement, dedupe, categorise, sampleStatement } from "../lib/statements";
import { createSeedDatabase } from "../lib/seed";

const db = createSeedDatabase();

// Three real M-Pesa codes out of the books, replayed as a statement.
const known = db.payments
  .filter((p) => /^[A-Z][A-Z0-9]{9}$/.test(p.reference))
  .slice(0, 3);
const overlap = known
  .map((p) => `${p.reference},2026-08-20 10:00:00,Received from ${p.customerName},${p.amount}.00,,0.00`)
  .join("\n");

const fresh = [
  "ZZA1B2C3D4,2026-08-29 09:14:22,Received from JANE WANJIKU,4200.00,,1.00",
  "ZZB5E6F7G8,2026-08-29 10:02:11,Paid to GIKOMBA MILLERS,,8600.00,1.00",
  "ZZB5E6F7G8,2026-08-29 10:02:11,Paid to GIKOMBA MILLERS,,8600.00,1.00",
  ",2026-08-29 18:30:00,Cash sale at the stall,3000.00,,1.00",
].join("\n");

const parsed = parseStatement(`${overlap}\n${fresh}`);
const summary = dedupe(parsed.rows, db);

const expect = (label: string, got: number, want: number) =>
  console.log(`${got === want ? "ok  " : "FAIL"} ${label}: ${got} (expect ${want})`);

console.log("real codes available in the books:", known.length);
expect("parsed rows", parsed.rows.length, 7);
expect("skipped lines", parsed.skipped.length, 0);
expect("already imported", summary.alreadyImported, 3);
expect("duplicate in file", summary.duplicateInFile, 1);
expect("needs review", summary.needsReview, 1);
expect("new", summary.fresh, 2);
console.log("directions:", summary.rows.map((r) => `${r.code || "—"}:${r.direction}`).join(" "));
console.log("categories:", summary.rows.map((r) => categorise(r.description, r.direction)).join(", "));

// Re-running the same file against books that now contain it must find zero new.
const afterImport = {
  ...db,
  ledger: [
    ...db.ledger,
    ...summary.rows
      .filter((r) => r.state === "new")
      .map((r) => ({
        id: r.code,
        date: r.date,
        type: (r.direction === "credit" ? "income" : "expense") as "income" | "expense",
        category: categorise(r.description, r.direction),
        description: r.description,
        amount: r.amount,
        source: "capture" as const,
        reference: r.code,
        reconciled: true,
      })),
  ],
};
expect("second pass new", dedupe(parsed.rows, afterImport).fresh, 0);

// And the built-in sample must visibly overlap the books, or the screen lies.
const sample = dedupe(parseStatement(sampleStatement(db)).rows, db);
console.log("\nsample statement:");
expect("sample already imported", sample.alreadyImported, 6);
expect("sample duplicate in file", sample.duplicateInFile, 1);
expect("sample needs review", sample.needsReview, 1);
expect("sample new", sample.fresh, 7);
