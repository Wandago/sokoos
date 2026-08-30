/** Checks the spoken-transaction parser on sentences a seller would actually say. */
import { parseSpoken } from "../lib/speech";
import { classifyDirection } from "../lib/direction";

const cases: [string, number | null, "credit" | "debit", string | null][] = [
  ["I received three thousand five hundred from Grace for two dresses", 3500, "credit", "Grace"],
  ["Received 4,200 from Jane Wanjiku on mpesa", 4200, "credit", "Jane Wanjiku"],
  ["I paid 8600 to Gikomba Millers for flour", 8600, "debit", "Gikomba Millers"],
  ["Bought packaging for 2k cash", 2000, "debit", null],
  ["Sold a cake for four thousand two hundred", 4200, "credit", "\u0000"],
  ["Spent one thousand five hundred on fuel", 1500, "debit", null],
  ["Paid the rider 350 bob", 350, "debit", null],
  ["Customer paid twelve thousand by bank transfer", 12000, "credit", null],
  ["Airtime 1000", 1000, "debit", null],
  ["Rent fifty thousand", 50000, "debit", null],
];

let failures = 0;
for (const [sentence, amount, direction, party] of cases) {
  const parsed = parseSpoken(sentence);
  const amountOk = parsed.amount === amount;
  const dirOk = parsed.verdict.direction === direction;
  const partyOk = party === "\u0000" ? parsed.party === null : party === null || parsed.party === party;
  const ok = amountOk && dirOk && partyOk;
  if (!ok) failures++;
  console.log(
    `${ok ? "ok  " : "FAIL"} "${sentence}"\n     amount ${parsed.amount} (want ${amount})  ${parsed.verdict.direction} (want ${direction})  party ${JSON.stringify(parsed.party)}${party === "\u0000" ? " (want null)" : party ? ` (want ${JSON.stringify(party)})` : ""}  ${parsed.category}  conf ${parsed.verdict.confidence}`,
  );
}

console.log("\ndirection reasons:");
["You have received Ksh4,200.00 from JANE WANJIKU", "Paid to GIKOMBA MILLERS", "Sundries 1200"].forEach(
  (t) => {
    const v = classifyDirection(t);
    console.log(` ${v.direction.padEnd(6)} ${v.confidence}  ${v.reason}  ← "${t}"`);
  },
);

console.log(failures ? `\n${failures} FAILURES` : "\nall cases pass");
process.exit(failures ? 1 : 0);
