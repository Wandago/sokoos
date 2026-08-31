/** Numbers, money and durations as they are actually said in Nairobi. */
import { parseSpokenNumber, parseSpokenDuration } from "../lib/swahili";
import { parseSpoken, parseSpokenItem } from "../lib/speech";

let failures = 0;
const expect = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label.padEnd(46)} ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
};

console.log("Swahili numbers:");
const numbers: [string, number][] = [
  ["elfu tatu", 3000],
  ["elfu tatu na mia tano", 3500],
  ["mia tano", 500],
  ["elfu kumi", 10000],
  ["elfu ishirini na tano", 25000],
  ["laki mbili", 200000],
  ["milioni moja", 1000000],
  ["mia nane", 800],
  ["elfu moja na mia mbili", 1200],
  ["hamsini", 50],
  ["elfu 3", 3000],
];
numbers.forEach(([said, want]) => expect(`"${said}"`, parseSpokenNumber(said)?.value ?? null, want));

console.log("\nSheng money:");
const sheng: [string, number][] = [
  ["ngiri tatu", 3000],
  ["ngiri", 1000],
  ["soo tano", 500],
  ["mbao", 20],
  ["finje", 50],
  ["thao mbili", 2000],
  ["chwani", 200],
];
sheng.forEach(([said, want]) => expect(`"${said}"`, parseSpokenNumber(said)?.value ?? null, want));

console.log("\nEnglish still works, and mixed sentences:");
const english: [string, number][] = [
  ["three thousand five hundred", 3500],
  ["four thousand two hundred", 4200],
  ["Nimepokea elfu tatu na mia tano kutoka kwa Grace", 3500],
  ["She paid ngiri tano for the dress", 5000],
  ["Nimelipa elfu nane na mia sita kwa Gikomba Millers", 8600],
  ["Nimeuza nguo mbili, mia tisa each", 900],
];
english.forEach(([said, want]) => expect(`"${said.slice(0, 42)}"`, parseSpokenNumber(said)?.value ?? null, want));

console.log("\nDurations:");
const durations: [string, number | null][] = [
  ["dakika arobaini na tano", 45],
  ["dakika 45", 45],
  ["45 minutes", 45],
  ["saa mbili", 120],
  ["2 hours", 120],
  ["saa moja", 60],
  ["nusu saa", 30],
  ["30 min", 30],
  ["no time mentioned", null],
];
durations.forEach(([said, want]) => expect(`"${said}"`, parseSpokenDuration(said), want));

console.log("\nWhole sentences, end to end:");
const spoken: [string, number | null, "credit" | "debit", string | null][] = [
  ["Nimepokea elfu tatu na mia tano kutoka kwa Grace", 3500, "credit", "Grace"],
  ["Nimelipa elfu nane na mia sita kwa Gikomba Millers", 8600, "debit", "Gikomba Millers"],
  ["Nimeuza nguo, ngiri mbili", 2000, "credit", null],
  ["Nimenunua unga, elfu moja na mia tano", 1500, "debit", null],
  ["Received four thousand two hundred from Jane", 4200, "credit", "Jane"],
  ["Nimelipa boda mia mbili", 200, "debit", null],
];
spoken.forEach(([said, amount, direction, party]) => {
  const parsed = parseSpoken(said);
  expect(`amount  "${said.slice(0, 38)}"`, parsed.amount, amount);
  expect(`money   "${said.slice(0, 38)}"`, parsed.verdict.direction, direction);
  if (party) expect(`who     "${said.slice(0, 38)}"`, parsed.party, party);
  console.log(`     -> ${parsed.category}, ${parsed.verdict.reason}`);
});

console.log("\nAdding to the catalogue by talking:");
const items: [string, "product" | "service", string, number | null, number | null][] = [
  // said, kind, name, price, duration
  ["Ongeza huduma, kushona nguo, elfu mbili, saa moja", "service", "Kushona nguo", 2000, 60],
  ["Add a service, box braids, three thousand five hundred, four hours", "service", "Box braids", 3500, 240],
  ["Ongeza bidhaa, hair food, mia nne hamsini", "product", "Hair food", 450, null],
  ["Add product, charging cable, 350", "product", "Charging cable", 350, null],
  ["Weka huduma, kunyoa, mia tatu, dakika thelathini", "service", "Kunyoa", 300, 30],
  ["New item, cement bag, 850", "product", "Cement bag", 850, null],
];
items.forEach(([said, kind, name, price, duration]) => {
  const item = parseSpokenItem(said);
  expect(`kind  "${said.slice(0, 40)}"`, item.kind, kind);
  expect(`name  "${said.slice(0, 40)}"`, item.name, name);
  expect(`price "${said.slice(0, 40)}"`, item.price, price);
  expect(`time  "${said.slice(0, 40)}"`, item.durationMinutes, duration);
  console.log(`     -> ${item.kindReason}`);
});

// A stated duration must beat wording that says nothing either way.
const ambiguous = parseSpokenItem("Ongeza kupiga picha, elfu nane, saa mbili");
expect("a time said out loud settles it as work", ambiguous.kind, "service");

console.log(failures ? `\n${failures} FAILURES` : "\nall assertions pass");
process.exit(failures ? 1 : 0);
