import type {
  Booking,
  Database,
  Order,
  Service,
  StaffMember,
} from "./types";
import { toBaseQty } from "./costing";
import { goodsTotal } from "./selectors";

/**
 * Costing and capacity for work sold by the hour.
 *
 * A goods business asks "how many can I make and what did each one cost?". A
 * service business asks two different questions, and this file answers both.
 *
 * What did the job cost? Mostly somebody's time, plus whatever it used up. A
 * two-hour braiding job is two hours of a stylist at their real hourly cost,
 * plus the extensions and the products. Sellers routinely leave the labour out
 * — it is their own hands, so it feels free — and then cannot work out why a
 * full diary leaves them no better off.
 *
 * What is scarce? Not shelf space: hours. A salon with three chairs and one
 * stylist cannot take a fourth booking at two o'clock however much stock it
 * holds, and an empty Tuesday is revenue that cannot be recovered later.
 */

export interface ServiceCost {
  /** Hours of somebody else's time that the business actually pays for. */
  paidLabour: number;
  /** Hours of the owner's own time. Not a cost — the thing being spent. */
  ownerHours: number;
  /** Thread, dye, extensions, fuel — whatever the job consumes. */
  materials: number;
  materialLines: { name: string; cost: number; qty: string }[];
  /** Money that actually leaves the business for this job. */
  cashCost: number;
  /** What is left after everything the business genuinely pays out. */
  earns: number;
  earnsPercent: number;
  /**
   * What an hour of the work earns after cash costs. For a sole trader this is
   * their wage and their profit at once, and it is the only number that lets
   * them compare a job against another job.
   */
  earnsPerHour: number;
  /** The whole time the job occupies, turnaround included. */
  hours: number;
  /** True when nobody is assigned and the time had to be assumed. */
  assumedRate: boolean;
  /** True when all the hours are the owner's own. */
  ownerOnly: boolean;
}

/** A fallback so an unassigned service still says something honest about time. */
const DEFAULT_DURATION_HOURS = 1;

export function costService(
  service: Service,
  db: Database,
  staffId?: string,
): ServiceCost {
  const staff = db.staff.find(
    (person) => person.id === (staffId ?? service.staffIds?.[0]),
  );

  // Buffer time is real time: the chair is occupied whether or not it is billed.
  const minutes = service.durationMinutes + (service.bufferMinutes ?? 0);
  const hours = minutes > 0 ? minutes / 60 : DEFAULT_DURATION_HOURS;

  // An owner's hour costs the business nothing. It is what the business has.
  const paysForTime = staff ? staff.kind === "employee" : false;
  const paidLabour = paysForTime ? hours * (staff?.hourlyCost ?? 0) : 0;
  const ownerHours = paysForTime ? 0 : hours;

  const materialLines = (service.materials ?? []).map((line) => {
    const ingredient = db.ingredients.find((i) => i.id === line.ingredientId);
    const baseQty = toBaseQty(line);
    return {
      name: ingredient?.name ?? "Missing item",
      cost: ingredient ? baseQty * ingredient.costPerUnit : 0,
      qty: `${line.qty} ${line.unit}`,
    };
  });

  const materials = materialLines.reduce((sum, line) => sum + line.cost, 0);
  const cashCost = paidLabour + materials;
  const earns = service.price - cashCost;

  return {
    paidLabour,
    ownerHours,
    materials,
    materialLines,
    cashCost,
    earns,
    earnsPercent: service.price > 0 ? (earns / service.price) * 100 : 0,
    earnsPerHour: hours > 0 ? earns / hours : 0,
    hours,
    assumedRate: !staff,
    ownerOnly: ownerHours > 0 && paidLabour === 0,
  };
}

/**
 * What being quicker is worth.
 *
 * The lever a sole trader actually controls is not price — customers know the
 * going rate and will walk — it is time. But "you could do 43 of these a week"
 * is arithmetic nobody believes, because nobody spends a week doing one job.
 * So this is grounded in what they actually did: how many of this job came
 * through in the last month, what shaving a few minutes off each would have
 * given back, and what that freed time is worth at what their work earns.
 */
export function fasterBy(
  service: Service,
  db: Database,
  savedMinutes: number,
  days = 30,
) {
  const cost = costService(service, db);
  const cutoff = Date.now() - days * 86400000;

  const done = bookings(db).filter(
    (order) =>
      order.booking.serviceId === service.id &&
      order.booking.state === "done" &&
      +new Date(order.booking.startsAt) >= cutoff,
  ).length;

  const hoursSaved = (done * savedMinutes) / 60;
  const hoursAfter = Math.max(0.1, cost.hours - savedMinutes / 60);

  return {
    savedMinutes,
    /** How many of this job actually came through in the window. */
    done,
    days,
    hoursNow: cost.hours,
    hoursAfter,
    hoursSaved,
    /** Whole extra jobs those freed hours would have fitted. */
    extraJobs: hoursAfter > 0 ? Math.floor(hoursSaved / hoursAfter) : 0,
    /** What those extra jobs would have left, at this job's own figure. */
    extraEarnings: (hoursAfter > 0 ? Math.floor(hoursSaved / hoursAfter) : 0) * cost.earns,
    earnsPerHourAfter: hoursAfter > 0 ? cost.earns / hoursAfter : 0,
  };
}

/** Every service, costed, worst profit per hour first. */
export function costedServices(db: Database) {
  return db.services
    .filter((service) => service.active)
    .map((service) => ({ service, cost: costService(service, db) }))
    .sort((a, b) => a.cost.earnsPerHour - b.cost.earnsPerHour);
}

/* ------------------------------------------------------------------ *
 * The diary
 * ------------------------------------------------------------------ */

export function isBooking(order: Order): order is Order & { booking: Booking } {
  return order.booking !== undefined;
}

export function bookings(db: Database) {
  return db.orders.filter(isBooking);
}

export function bookingEnd(booking: Booking) {
  return new Date(+new Date(booking.startsAt) + booking.durationMinutes * 60000);
}

function sameDay(iso: string, day: Date) {
  const at = new Date(iso);
  return (
    at.getFullYear() === day.getFullYear() &&
    at.getMonth() === day.getMonth() &&
    at.getDate() === day.getDate()
  );
}

/** Everything in the diary for one day, in the order it happens. */
export function bookingsOn(db: Database, day: Date) {
  return bookings(db)
    .filter(
      (order) =>
        sameDay(order.booking.startsAt, day) &&
        order.booking.state !== "cancelled",
    )
    .sort((a, b) => +new Date(a.booking.startsAt) - +new Date(b.booking.startsAt));
}

export interface Capacity {
  /** Hours the team is on for, across everyone working that day. */
  available: number;
  /** Hours already committed, buffers included. */
  booked: number;
  free: number;
  /** Hours promised beyond what the team is on for. Overtime, or a mistake. */
  overbooked: number;
  utilisation: number;
  /** What the day's work will bring in, if it all happens. */
  booked_value: number;
  /**
   * Roughly what the free hours could still earn, at the average an hour of
   * this business's work actually earns. An empty hour is not free — it is the
   * one thing that cannot be bought back.
   */
  idleValue: number;
}

export function capacityOn(db: Database, day: Date): Capacity {
  const weekday = day.getDay();
  const working = db.staff.filter(
    (person) => person.active && person.workingDays.includes(weekday),
  );
  const available = working.reduce(
    (sum, person) => sum + Math.max(0, person.endHour - person.startHour),
    0,
  );

  const todays = bookingsOn(db, day).filter(
    (order) => order.booking.state !== "no_show",
  );
  const booked = todays.reduce((sum, order) => {
    const service = db.services.find((s) => s.id === order.booking.serviceId);
    const minutes = order.booking.durationMinutes + (service?.bufferMinutes ?? 0);
    return sum + minutes / 60;
  }, 0);

  const bookedValue = todays.reduce((sum, order) => sum + goodsTotal(order), 0);

  const costed = costedServices(db);
  const averageProfitPerHour = costed.length
    ? costed.reduce((sum, row) => sum + row.cost.earnsPerHour, 0) / costed.length
    : 0;
  const free = Math.max(0, available - booked);

  return {
    available,
    booked,
    free,
    overbooked: Math.max(0, booked - available),
    utilisation: available > 0 ? (booked / available) * 100 : 0,
    booked_value: bookedValue,
    idleValue: free * Math.max(0, averageProfitPerHour),
  };
}

/** Utilisation per person, so an overloaded stylist is visible. */
export function staffLoadOn(db: Database, day: Date) {
  const weekday = day.getDay();
  const todays = bookingsOn(db, day);

  return db.staff
    .filter((person) => person.active)
    .map((person) => {
      const working = person.workingDays.includes(weekday);
      const hours = person.endHour - person.startHour;
      const theirs = todays.filter((order) => order.booking.staffId === person.id);
      const booked = theirs.reduce((sum, order) => {
        const service = db.services.find((s) => s.id === order.booking.serviceId);
        return sum + (order.booking.durationMinutes + (service?.bufferMinutes ?? 0)) / 60;
      }, 0);
      return {
        staff: person,
        working,
        available: working ? hours : 0,
        booked,
        jobs: theirs.length,
        utilisation: working && hours > 0 ? (booked / hours) * 100 : 0,
      };
    })
    .sort((a, b) => b.utilisation - a.utilisation);
}

/**
 * Whether a person is free for a job at a given time. Buffers count, because a
 * chair that is being cleaned is not a chair that is available.
 */
export function isFree(
  db: Database,
  staffId: string,
  startsAt: string,
  durationMinutes: number,
) {
  const start = +new Date(startsAt);
  const end = start + durationMinutes * 60000;

  return !bookings(db).some((order) => {
    if (order.booking.staffId !== staffId) return false;
    if (order.booking.state === "cancelled" || order.booking.state === "no_show") return false;
    const service = db.services.find((s) => s.id === order.booking.serviceId);
    const theirStart = +new Date(order.booking.startsAt);
    const theirEnd =
      theirStart + (order.booking.durationMinutes + (service?.bufferMinutes ?? 0)) * 60000;
    return start < theirEnd && end > theirStart;
  });
}

/** Open slots on a day for one person, at the granularity they book in. */
export function openSlots(
  db: Database,
  staff: StaffMember,
  day: Date,
  durationMinutes: number,
  stepMinutes = 30,
) {
  if (!staff.workingDays.includes(day.getDay())) return [];

  const slots: string[] = [];
  for (let hour = staff.startHour; hour < staff.endHour; hour += stepMinutes / 60) {
    const at = new Date(day);
    at.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0);
    // A slot that runs past closing time is not a slot.
    const finishes = new Date(+at + durationMinutes * 60000);
    if (finishes.getHours() + finishes.getMinutes() / 60 > staff.endHour) continue;
    if (isFree(db, staff.id, at.toISOString(), durationMinutes)) slots.push(at.toISOString());
  }
  return slots;
}

/* ------------------------------------------------------------------ *
 * Deposits
 * ------------------------------------------------------------------ */

/** A booking that was held without the deposit that was supposed to hold it. */
export function unpaidDeposits(db: Database) {
  return bookings(db).filter(
    (order) =>
      order.booking.state === "booked" &&
      (order.booking.deposit ?? 0) > 0 &&
      !order.booking.depositPaidAt,
  );
}

export function depositsHeld(db: Database) {
  return bookings(db)
    .filter(
      (order) =>
        order.booking.depositPaidAt &&
        (order.booking.state === "booked" || order.booking.state === "enquiry"),
    )
    .reduce((sum, order) => sum + (order.booking.deposit ?? 0), 0);
}

/** Jobs finished but not yet settled — the balance after any deposit. */
export function unpaidJobs(db: Database) {
  return bookings(db).filter(
    (order) =>
      order.booking.state === "done" &&
      order.paymentStatus !== "paid" &&
      order.paymentStatus !== "refunded",
  );
}

export function suggestedDeposit(service: Service, price: number) {
  const percent = service.depositPercent ?? 0;
  return percent > 0 ? Math.round((price * percent) / 100 / 50) * 50 : 0;
}
