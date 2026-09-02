import type { Database, LedgerEntry } from "./types";
import { costedProducts, lowIngredients, stockValue } from "./costing";
import { capacityOn, costedServices, fasterBy, unpaidDeposits } from "./services";
import {
  ledgerTotals,
  monthOverMonth,
  riderFloat,
  riderFloatByRider,
  sellerReceives,
  unmatchedPayments,
} from "./selectors";
import { bargainReport } from "./pos";

/**
 * The CFO brief.
 *
 * A finance director does not intuit; they reconcile. So does this. Every
 * figure here is arithmetic on the seller's own ledger, and every finding
 * carries the numbers it was derived from, so it can be checked rather than
 * believed. Nothing is invented, and nothing is hidden behind a score.
 */

export type Severity = "urgent" | "watch" | "good";

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  /** The single number the finding turns on. */
  figure: string;
  body: string;
  /** How the figure was arrived at, in the seller's own numbers. */
  workings: string;
  action?: { label: string; href: string };
}

export interface CashPosition {
  income: number;
  expenses: number;
  net: number;
  /** Average money out per day over the window. */
  burnPerDay: number;
  /**
   * If income stopped today, how many days the surplus you kept would cover at
   * that rate of spending. A cushion, not a forecast — zero when there is none.
   */
  cushionDays: number;
}

export function cashPosition(db: Database, days = 30): CashPosition {
  const { income, expenses } = ledgerTotals(db, days);
  const net = income - expenses;
  const burnPerDay = expenses / days;
  return {
    income,
    expenses,
    net,
    burnPerDay,
    cushionDays: net <= 0 || burnPerDay <= 0 ? 0 : net / burnPerDay,
  };
}

export interface Coverage {
  entries: number;
  /** Entries carrying a reference that can be traced to a source document. */
  traced: number;
  reconciled: number;
  percent: number;
  /** Shillings sitting outside the ledger because a payment is unmatched. */
  loose: number;
}

/** How much of the money actually has a paper trail behind it. */
export function coverage(db: Database, days = 30): Coverage {
  const cutoff = Date.now() - days * 86400000;
  const entries = db.ledger.filter((e) => +new Date(e.date) >= cutoff);
  const traced = entries.filter((e) => Boolean(e.reference)).length;
  const reconciled = entries.filter((e) => e.reconciled).length;
  const loose = unmatchedPayments(db).reduce((sum, p) => sum + p.amount, 0);
  return {
    entries: entries.length,
    traced,
    reconciled,
    percent: entries.length ? (reconciled / entries.length) * 100 : 100,
    loose,
  };
}

export interface CategoryLine {
  category: string;
  amount: number;
  previous: number;
  share: number;
  delta: number;
}

/** Where the money went, this window against the last one of the same length. */
export function expenseMix(db: Database, days = 30): CategoryLine[] {
  const now = Date.now();
  const thisStart = now - days * 86400000;
  const lastStart = now - days * 2 * 86400000;

  const sum = (list: LedgerEntry[]) => list.reduce((s, e) => s + e.amount, 0);
  const window = (from: number, to: number) =>
    db.ledger.filter(
      (e) => e.type === "expense" && +new Date(e.date) >= from && +new Date(e.date) < to,
    );

  const current = window(thisStart, now);
  const previous = window(lastStart, thisStart);
  const total = sum(current);

  const categories = new Set(current.map((e) => e.category));
  return [...categories]
    .map((category) => {
      const amount = sum(current.filter((e) => e.category === category));
      const before = sum(previous.filter((e) => e.category === category));
      return {
        category,
        amount,
        previous: before,
        share: total ? (amount / total) * 100 : 0,
        delta: before > 0 ? ((amount - before) / before) * 100 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

/** Cost of every shilling of revenue, split the way a P&L would. */
export function costPerShilling(db: Database, days = 30) {
  const { income, expenses } = ledgerTotals(db, days);
  if (income <= 0) return { expenses: 0, kept: 0 };
  return { expenses: expenses / income, kept: (income - expenses) / income };
}

/**
 * The brief itself: at most a handful of findings, ordered by what would cost
 * the most to ignore. Silence is a valid answer — if nothing is wrong, the
 * brief says so rather than inventing something to worry about.
 */
export function cfoFindings(db: Database): Finding[] {
  const found: Finding[] = [];
  const cash = cashPosition(db);
  const cover = coverage(db);
  const mix = expenseMix(db);
  const mom = monthOverMonth(db);
  const costed = costedProducts(db);
  const short = lowIngredients(db.ingredients);

  // 1. Money that has not been tied to anything.
  const unmatched = unmatchedPayments(db);
  if (unmatched.length > 0) {
    found.push({
      id: "unmatched",
      severity: unmatched.length >= 3 ? "urgent" : "watch",
      title: "Payments without a home",
      figure: kes(cover.loose),
      body: `${unmatched.length} ${unmatched.length === 1 ? "payment has" : "payments have"} come in without being tied to an order. Until they are matched, that money is in your till but not in your books.`,
      workings: `${unmatched.length} unmatched payments totalling ${kes(cover.loose)}.`,
      action: { label: "Match them", href: "/payments/" },
    });
  }

  // 2. Spending outrunning income.
  if (cash.net < 0) {
    found.push({
      id: "negative",
      severity: "urgent",
      title: "You spent more than you took in",
      figure: kes(Math.abs(cash.net)),
      body: `Over the last 30 days ${kes(cash.expenses)} went out against ${kes(cash.income)} in. At the current rate that is ${kes(cash.burnPerDay)} a day going out.`,
      workings: `${kes(cash.income)} income − ${kes(cash.expenses)} expenses = −${kes(Math.abs(cash.net))}.`,
      action: { label: "Open the ledger", href: "/ledger/" },
    });
  }

  // 3. A category that jumped.
  const jumped = mix.find((line) => line.previous > 0 && line.delta > 25 && line.amount > 2000);
  if (jumped) {
    found.push({
      id: `spike-${jumped.category}`,
      severity: "watch",
      title: `${jumped.category} is up ${jumped.delta.toFixed(0)}%`,
      figure: kes(jumped.amount - jumped.previous),
      body: `${jumped.category} cost you ${kes(jumped.amount)} this month against ${kes(jumped.previous)} last month. It is ${jumped.share.toFixed(0)}% of everything you spend.`,
      workings: `${kes(jumped.amount)} this 30 days vs ${kes(jumped.previous)} the 30 before.`,
      action: { label: "See the ledger", href: "/ledger/" },
    });
  }

  // 4a. A job that does not even cover what it consumes.
  const services = costedServices(db);
  const losingService = services.find((row) => row.cost.earns < 0);
  if (losingService) {
    const { service, cost } = losingService;
    found.push({
      id: "service-underwater",
      severity: "urgent",
      title: `${service.name} costs more than it earns`,
      figure: kes(Math.abs(cost.earns)),
      body: `It is priced at ${kes(service.price)} and ${kes(cost.cashCost)} goes straight back out on ${cost.materials > cost.paidLabour ? "materials" : "paid time"}. You end up ${kes(Math.abs(cost.earns))} down and ${cost.hours.toFixed(1)} hours poorer, before you have paid yourself anything.`,
      workings: `${kes(service.price)} price − ${kes(cost.materials)} materials${cost.paidLabour > 0 ? ` − ${kes(cost.paidLabour)} paid time` : ""}.`,
      action: { label: "Open the service", href: `/stock/?service=${service.id}` },
    });
  }

  // 4b. The job that fills the diary is not always the job worth doing.
  // Compare only jobs that earn; one that does not is its own finding.
  const earning = services.filter((row) => row.cost.earnsPerHour > 0);
  if (earning.length > 1) {
    const worst = earning[0];
    const best = earning[earning.length - 1];
    if (best.cost.earnsPerHour > worst.cost.earnsPerHour * 2) {
      const faster = fasterBy(worst.service, db, Math.min(20, Math.round(worst.service.durationMinutes * 0.2)));
      found.push({
        id: "earns-per-hour",
        severity: "watch",
        title: "An hour is not an hour",
        figure: `${kes(best.cost.earnsPerHour)}/hr`,
        body: `${best.service.name} leaves you ${kes(best.cost.earnsPerHour)} an hour. ${worst.service.name} leaves ${kes(worst.cost.earnsPerHour)}. Both eat the same day.${
          faster.extraJobs > 0
            ? ` Take ${faster.savedMinutes} minutes off the slower one and you fit ${faster.extraJobs} more a week — about ${kes(faster.extraEarnings)}, without raising a price.`
            : ""
        }`,
        workings: `What each job leaves after materials and any paid time, divided by the hours it occupies including turnaround.`,
        action: { label: "Compare the work", href: "/stock/" },
      });
    }
  }

  // 4c. Hours that were on but earned nothing.
  if (db.staff.some((person) => person.active)) {
    const day = new Date();
    const cap = capacityOn(db, day);
    if (cap.available > 0 && cap.free >= 2 && cap.idleValue > 0) {
      found.push({
        id: "idle-capacity",
        severity: cap.utilisation < 50 ? "watch" : "good",
        title: `${cap.free.toFixed(1)} hours going spare today`,
        figure: kes(cap.idleValue),
        body: `The team is on for ${cap.available.toFixed(0)} hours and ${cap.booked.toFixed(1)} are booked — ${cap.utilisation.toFixed(0)}%. An empty hour costs the same as a busy one and cannot be sold back later.`,
        workings: `${cap.free.toFixed(1)} free hours at the average profit per hour of what you actually sell.`,
        action: { label: "Open the diary", href: "/bookings/" },
      });
    }
    if (cap.overbooked > 0) {
      found.push({
        id: "overbooked",
        severity: "urgent",
        title: `You have promised ${cap.overbooked.toFixed(1)} hours you do not have today`,
        figure: `${cap.booked.toFixed(1)}h booked`,
        body: `Against ${cap.available.toFixed(0)} hours the team is actually on for. Something will run late or somebody will be turned away.`,
        workings: `Booked hours including turnaround, against the hours worked by everyone in today.`,
        action: { label: "Open the diary", href: "/bookings/" },
      });
    }
  }

  // 4d. A slot held without the deposit that was meant to hold it.
  const owedDeposits = unpaidDeposits(db);
  if (owedDeposits.length) {
    const total = owedDeposits.reduce((sum, o) => sum + (o.booking?.deposit ?? 0), 0);
    found.push({
      id: "deposits",
      severity: "watch",
      title: `${owedDeposits.length} ${owedDeposits.length === 1 ? "slot is" : "slots are"} held with no deposit`,
      figure: kes(total),
      body: `A deposit is what stops a no-show costing you the whole slot. ${owedDeposits.map((o) => o.code).join(", ")} ${owedDeposits.length === 1 ? "has" : "have"} been booked without one.`,
      workings: `Bookings in the diary whose service asks for a deposit and where none has been paid.`,
      action: { label: "Open the diary", href: "/bookings/" },
    });
  }

  // 5. Anything sold below what it costs to make.
  const bleeding = costed.filter((row) => row.cost.margin <= 0);
  if (bleeding.length) {
    const worst = bleeding[0];
    found.push({
      id: "underwater",
      severity: "urgent",
      title: `${worst.product.name} sells for less than it costs`,
      figure: kes(Math.abs(worst.cost.margin)),
      body: `It sells at ${kes(worst.product.price)} and costs ${kes(worst.cost.unitCost)} in ingredients alone, before delivery or your time. Every one you sell loses ${kes(Math.abs(worst.cost.margin))}.`,
      workings: `${kes(worst.product.price)} price − ${kes(worst.cost.unitCost)} ingredient cost.`,
      action: { label: "Open the recipe", href: `/stock/?id=${worst.product.id}` },
    });
  } else {
    const thin = costed.find((row) => row.cost.marginPercent < 25);
    if (thin) {
      found.push({
        id: "thin-margin",
        severity: "watch",
        title: `${thin.product.name} is your thinnest margin`,
        figure: `${thin.cost.marginPercent.toFixed(0)}%`,
        body: `It keeps ${kes(thin.cost.margin)} of every ${kes(thin.product.price)}. ${
          thin.cost.limitedBy
            ? `${thin.cost.limitedBy.name} is the ingredient to renegotiate first.`
            : "Look at the ingredient prices before you raise the price."
        }`,
        workings: `${kes(thin.product.price)} price − ${kes(thin.cost.unitCost)} cost = ${kes(thin.cost.margin)}.`,
        action: { label: "Open the recipe", href: `/stock/?id=${thin.product.id}` },
      });
    }
  }

  // 6. Production about to stop.
  if (short.length) {
    const blocked = costed.filter((row) => row.cost.makeable === 0);
    found.push({
      id: "ingredients-low",
      severity: blocked.length ? "urgent" : "watch",
      title: blocked.length
        ? `You cannot make ${blocked.length} of your products`
        : `${short.length} ingredients are running low`,
      figure: short
        .slice(0, 2)
        .map((i) => i.name)
        .join(", "),
      body: blocked.length
        ? `${blocked.map((b) => b.product.name).join(", ")} cannot be made until you restock. Every order you turn away is revenue that does not come back.`
        : `${short.map((i) => i.name).join(", ")} ${short.length === 1 ? "is" : "are"} below your reorder line. You hold ${kes(stockValue(db.ingredients))} of stock in total.`,
      workings: `${short.length} of ${db.ingredients.length} ingredients at or below their reorder point.`,
      action: { label: "Check the store", href: "/stock/" },
    });
  }

  // 7. One category carrying most of the spending.
  const dominant = mix[0];
  if (dominant && dominant.share >= 60 && mix.length > 1) {
    found.push({
      id: `concentration-${dominant.category}`,
      severity: "watch",
      title: `${dominant.share.toFixed(0)}% of your spending is ${dominant.category.toLowerCase()}`,
      figure: kes(dominant.amount),
      body: `Of ${kes(cash.expenses)} spent in 30 days, ${kes(dominant.amount)} went on ${dominant.category.toLowerCase()}. A 5% better price there is ${kes(dominant.amount * 0.05)} straight onto your bottom line — more than cutting anything else to zero.`,
      workings: `${kes(dominant.amount)} of ${kes(cash.expenses)} total expenses.`,
      action: { label: "See the ledger", href: "/ledger/" },
    });
  }

  // 8. Entries nobody has tied off.
  if (cover.entries > 0 && cover.percent < 95) {
    const open = cover.entries - cover.reconciled;
    found.push({
      id: "coverage",
      severity: cover.percent < 80 ? "watch" : "good",
      title: `${cover.percent.toFixed(0)}% of your books are reconciled`,
      figure: `${open} open`,
      body: `${open} of ${cover.entries} entries in the last 30 days have not been tied to a payment or a document. That is the gap between what you think you made and what you can prove.`,
      workings: `${cover.reconciled} reconciled of ${cover.entries} entries in the window.`,
      action: { label: "Import a statement", href: "/import/" },
    });
  }

  // 9. Cash a rider is still holding.
  const float = riderFloat(db);
  if (float > 0) {
    const holders = riderFloatByRider(db);
    const top = holders[0];
    found.push({
      id: "rider-float",
      severity: float > cash.income * 0.03 ? "urgent" : "watch",
      title: "Cash still with your riders",
      figure: kes(float),
      body: `${holders.length === 1 ? `${top.rider?.name ?? "A rider"} is` : `${holders.length} riders are`} holding money collected on your behalf. The orders read as paid, but the cash has not reached you${top.rider ? ` — ${top.rider.name} alone has ${kes(top.amount)} from ${top.trips} ${top.trips === 1 ? "trip" : "trips"}` : ""}.`,
      workings: `${holders.reduce((n, h) => n + h.trips, 0)} deliveries where the rider collected and has not yet remitted.`,
      action: { label: "See the deliveries", href: "/deliveries/" },
    });
  }

  // 10. Money owed to you.
  const owed = db.orders
    .filter((o) => o.status !== "cancelled" && (o.paymentStatus === "unpaid" || o.paymentStatus === "partial"))
    .reduce((sum, o) => sum + sellerReceives(o), 0);
  if (owed > 0) {
    found.push({
      id: "receivables",
      severity: owed > cash.income * 0.15 ? "watch" : "good",
      title: "Owed to you",
      figure: kes(owed),
      body: `That is money already earned and still outside your account. It is ${((owed / Math.max(cash.income, 1)) * 100).toFixed(0)}% of what you collected in the last 30 days.`,
      workings: "Total of every unpaid and part-paid order that has not been cancelled.",
      action: { label: "See the orders", href: "/orders/" },
    });
  }

  // 11. Something genuinely going right, said only when it is true.
  if (mom.revenue.delta > 8 && cash.net > 0) {
    found.push({
      id: "growing",
      severity: "good",
      title: `Revenue up ${mom.revenue.delta.toFixed(0)}%`,
      figure: kes(mom.revenue.change),
      body: `You collected ${kes(mom.revenue.value)} this month against ${kes(mom.revenue.previous)} last month, and kept ${kes(cash.net)} of it.`,
      workings: `${kes(mom.revenue.value)} this 30 days vs ${kes(mom.revenue.previous)} the 30 before.`,
    });
  }

  /* What the haggling cost.
   *
   * Invisible one sale at a time and decisive by the thirtieth: two hundred
   * shillings off a phone feels like nothing at the counter. This is not an
   * argument against bargaining — it is how business is done here — but a
   * seller who knows the number can decide where to hold, or price with the
   * negotiation already built in. Raised only once there is enough of it to
   * be worth a conversation. */
  const haggling = bargainReport(db, 30);
  if (haggling.given > 0 && haggling.sales >= 3) {
    const worst = haggling.worst[0];
    found.push({
      id: "bargaining",
      severity: haggling.averageCut > 0.12 ? "watch" : "good",
      title: "What bargaining cost you",
      figure: kes(haggling.given),
      body:
        `${Math.round(haggling.rate * 100)}% of your sales in the last 30 days were negotiated, ` +
        `at an average of ${(haggling.averageCut * 100).toFixed(1)}% off the asking price.` +
        (worst
          ? ` ${worst.name} gets talked down most — ${worst.times} times, ${kes(worst.given)} in total.`
          : "") +
        " Nothing wrong with that. It is worth knowing the number.",
      workings: `${haggling.sales} of ${haggling.total} sales negotiated, ${kes(haggling.given)} off the listed prices.`,
      action: { label: "See what you sell", href: "/products/" },
    });
  }

  const rank: Record<Severity, number> = { urgent: 0, watch: 1, good: 2 };
  return found.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, 6);
}

function kes(value: number) {
  return `KES ${Math.round(value).toLocaleString("en-KE")}`;
}
