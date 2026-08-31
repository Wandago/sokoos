/** Checks service costing, capacity and deposits against the seeded diary. */
import { createSeedDatabase } from "../lib/seed";
import {
  bookingsOn,
  fasterBy,
  capacityOn,
  costService,
  costedServices,
  depositsHeld,
  isFree,
  openSlots,
  staffLoadOn,
  unpaidDeposits,
} from "../lib/services";

const db = createSeedDatabase();
let failures = 0;
const expect = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}: ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
};

console.log("what each job leaves, worst per hour first:\n");
costedServices(db).forEach(({ service, cost }) =>
  console.log(
    ` ${service.name.padEnd(30)} ${String(service.price).padStart(5)} ` +
      `${cost.hours.toFixed(1)}h  materials ${cost.materials.toFixed(0).padStart(4)}  ` +
      `paid time ${cost.paidLabour.toFixed(0).padStart(5)}  ` +
      `leaves ${cost.earns.toFixed(0).padStart(5)} = ${cost.earnsPerHour.toFixed(0).padStart(5)}/hr` +
      `${cost.ownerOnly ? "  (your own hours)" : ""}`,
  ),
);

/* The correction that matters: an owner's hour is not money leaving the
 * business. Charging it as a cost says their own profit is an expense. */
const styling = db.services.find((s) => s.id === "svc_5")!; // owner does this one
const stylingCost = costService(styling, db);
expect("an owner's hours are not charged as a cost", stylingCost.paidLabour, 0);
expect("they are counted as hours spent", Math.round(stylingCost.ownerHours * 10), 10);
expect("so the job leaves the whole price, less materials", Math.round(stylingCost.earns), styling.price);
expect("and it is flagged as owner-only", stylingCost.ownerOnly, true);

// An employee's hour, by contrast, is money that really goes out.
const hem = db.services.find((s) => s.id === "svc_1")!; // Mercy, employed
const hemCost = costService(hem, db);
expect("an employee's time is a real cost", Math.round(hemCost.paidLabour), Math.round((55 / 60) * 520));
expect("charged on the time the chair is occupied, buffer included", Math.round(hemCost.hours * 100), Math.round((55 / 60) * 100));
expect("materials come from the same store as recipes", hemCost.materialLines.length, 1);
expect(
  "what it leaves is the price less everything that actually goes out",
  Math.round(hemCost.earns),
  Math.round(hem.price - hemCost.paidLabour - hemCost.materials),
);

expect("a staffed service knows whose time it is", stylingCost.assumedRate, false);
expect(
  "an unassigned one assumes you are doing it yourself",
  costService({ ...styling, staffIds: [] }, db).ownerOnly,
  true,
);

/* Price is set by what customers will pay. Time is the lever a sole trader
 * actually controls, so being quicker has to be measurable. */
const faster = fasterBy(hem, db, 15);
console.log(
  `\n${hem.name}: ${faster.done} done in ${faster.days} days. 15 min off each = ` +
    `${faster.hoursSaved.toFixed(1)}h back = ${faster.extraJobs} more job(s), about ${Math.round(faster.extraEarnings)}`,
);
expect("the saving is grounded in jobs actually done", faster.hoursSaved, (faster.done * 15) / 60);
expect("freed hours become whole jobs, not fractions", faster.extraJobs, Math.floor(faster.hoursSaved / faster.hoursAfter));
expect("and the extra is counted at what each job leaves", Math.round(faster.extraEarnings), Math.round(faster.extraJobs * hemCost.earns));
expect("saving no time changes nothing", fasterBy(hem, db, 0).extraJobs, 0);

/* The seed snaps every booking onto a day its tailor actually works, so on a
 * Sunday the diary is legitimately empty. Test the day the work is on. */
const today = new Date();
const day = (() => {
  for (let ahead = 0; ahead < 8; ahead++) {
    const candidate = new Date(today);
    candidate.setDate(candidate.getDate() + ahead);
    if (bookingsOn(db, candidate).length) return candidate;
  }
  return today;
})();
console.log(`\nthe diary on ${day.toDateString()}:`);
bookingsOn(db, day).forEach((order) => {
  const at = new Date(order.booking.startsAt);
  const service = db.services.find((s) => s.id === order.booking.serviceId);
  const staff = db.staff.find((p) => p.id === order.booking.staffId);
  console.log(
    ` ${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")} ` +
      `${(service?.name ?? "").padEnd(30)} ${(staff?.name ?? "").padEnd(16)} ${order.booking.state}`,
  );
});

const cap = capacityOn(db, day);
console.log(
  `\ncapacity: ${cap.booked.toFixed(1)} of ${cap.available.toFixed(1)} hours booked ` +
    `(${cap.utilisation.toFixed(0)}%), ${cap.free.toFixed(1)} free`,
);
console.log(` today's diary is worth ${Math.round(cap.booked_value)}; the idle hours could have earned about ${Math.round(cap.idleValue)}`);
expect("free hours are what is left after the diary", Math.round(cap.free * 10), Math.round(Math.max(0, cap.available - cap.booked) * 10));
expect("an overbooked day is reported, not hidden", cap.overbooked > 0, cap.booked > cap.available);
expect("the diary only lands on days people work", staffLoadOn(db, day).filter((r) => !r.working && r.jobs > 0).length, 0);

console.log("\nload per person:");
staffLoadOn(db, day).forEach((row) =>
  console.log(
    ` ${row.staff.name.padEnd(18)} ${row.working ? `${row.booked.toFixed(1)}/${row.available}h` : "not working"} ` +
      `${row.working ? `${row.utilisation.toFixed(0)}%` : ""}  ${row.jobs} job(s)`,
  ),
);

// Double-booking is the thing a diary exists to prevent.
const busy = bookingsOn(db, day).find((o) => o.booking.state !== "no_show")!;
expect(
  "a person is not free during a job they are already doing",
  isFree(db, busy.booking.staffId!, busy.booking.startsAt, busy.booking.durationMinutes),
  false,
);
const late = new Date(busy.booking.startsAt);
late.setDate(late.getDate() + 30);
expect("but is free on an empty day", isFree(db, busy.booking.staffId!, late.toISOString(), 45), true);

const mercy = db.staff.find((p) => p.id === "stf_1")!;
const slots = openSlots(db, mercy, day, 45);
console.log(`\n${mercy.name} has ${slots.length} open 45-minute slots today`);
expect(
  "no offered slot collides with an existing job",
  slots.every((slot) => isFree(db, mercy.id, slot, 45)),
  true,
);
expect(
  "and none runs past closing time",
  slots.every((slot) => new Date(+new Date(slot) + 45 * 60000).getHours() <= mercy.endHour),
  true,
);
const sunday = new Date(day);
sunday.setDate(sunday.getDate() + ((7 - day.getDay()) % 7 || 7));
expect("a day off offers nothing", openSlots(db, mercy, sunday, 45).length, 0);
expect("and a closed day has no capacity at all", capacityOn(db, sunday).available, 0);

console.log("\ndeposits:");
console.log(` held against future work: ${Math.round(depositsHeld(db))}`);
const owed = unpaidDeposits(db);
console.log(` slots held with no deposit paid: ${owed.length} (${owed.map((o) => o.code).join(", ") || "none"})`);
expect("every unpaid deposit is a booked job that owes one", owed.every((o) => o.booking.state === "booked" && (o.booking.deposit ?? 0) > 0 && !o.booking.depositPaidAt), true);

console.log(failures ? `\n${failures} FAILURES` : "\nall assertions pass");
process.exit(failures ? 1 : 0);
