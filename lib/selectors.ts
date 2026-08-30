import { isSameDay } from "./format";
import type {
  Customer,
  Database,
  DeliverySettlement,
  Order,
  Product,
  Rider,
} from "./types";

/** Timestamp `days` before now — kept out of render memos, which must be pure. */
export function daysAgoCutoff(days: number) {
  return Date.now() - days * 86400000;
}

export function orderSubtotal(order: Order) {
  return order.items.reduce((sum, it) => sum + it.price * it.qty, 0);
}

/**
 * Records written before delivery settlement was modelled behaved as though
 * the seller charged the fee and paid the rider, so that is how they are read.
 */
export function settlementOf(order: Order): DeliverySettlement {
  return order.deliverySettlement ?? "business_pays_rider";
}

/** Goods, after any discount. Never includes the trip. */
export function goodsTotal(order: Order) {
  return orderSubtotal(order) - order.discount;
}

/**
 * What the seller actually receives.
 *
 * When the customer pays the rider directly — the usual arrangement with an
 * independent boda — the delivery fee never passes through the business, so
 * adding it here would invent revenue that does not exist. It counts only when
 * the seller is the one charging for the trip.
 */
export function sellerReceives(order: Order) {
  const settlement = settlementOf(order);
  const collectsFee = settlement === "business_pays_rider" || settlement === "rider_collects";
  return goodsTotal(order) + (collectsFee ? order.deliveryFee : 0);
}

/** What the customer hands over in total, to whoever ends up holding it. */
export function customerPays(order: Order) {
  return goodsTotal(order) + (settlementOf(order) === "free" ? 0 : order.deliveryFee);
}

/**
 * What the seller owes the rider for this trip. Zero when the customer settles
 * with the rider at the door.
 */
export function riderOwed(order: Order) {
  const settlement = settlementOf(order);
  return settlement === "business_pays_rider" || settlement === "free" ? order.deliveryFee : 0;
}

export function customerOf(db: Database, order: Order): Customer | undefined {
  return db.customers.find((c) => c.id === order.customerId);
}

export function riderOf(db: Database, order: Order): Rider | undefined {
  return db.riders.find((r) => r.id === order.riderId);
}

export function orderById(db: Database, orderId: string) {
  return db.orders.find((o) => o.id === orderId);
}

const OPEN_STATUSES: Order["status"][] = ["new", "confirmed", "packed"];

export interface TodayStats {
  revenue: number;
  orders: number;
  pending: number;
  delivered: number;
  outForDelivery: number;
  unpaid: number;
  averageOrderValue: number;
  revenueChange: number;
}

export function todayStats(db: Database): TodayStats {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);

  const todays = db.orders.filter((o) => isSameDay(o.createdAt, today) && o.status !== "cancelled");
  const yesterdays = db.orders.filter(
    (o) => isSameDay(o.createdAt, yesterday) && o.status !== "cancelled",
  );

  const paidRevenue = todays
    .filter((o) => o.paymentStatus === "paid" || o.paymentStatus === "partial")
    .reduce((sum, o) => sum + (o.paymentStatus === "partial" ? sellerReceives(o) / 2 : sellerReceives(o)), 0);

  const yesterdayRevenue = yesterdays
    .filter((o) => o.paymentStatus === "paid")
    .reduce((sum, o) => sum + sellerReceives(o), 0);

  const unpaid = todays
    .filter((o) => o.paymentStatus === "unpaid" || o.paymentStatus === "cod")
    .reduce((sum, o) => sum + sellerReceives(o), 0);

  const revenueChange =
    yesterdayRevenue > 0 ? ((paidRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : 0;

  return {
    revenue: Math.round(paidRevenue),
    orders: todays.length,
    pending: todays.filter((o) => OPEN_STATUSES.includes(o.status)).length,
    delivered: todays.filter((o) => o.status === "delivered").length,
    outForDelivery: todays.filter((o) => o.status === "out_for_delivery").length,
    unpaid: Math.round(unpaid),
    averageOrderValue: todays.length ? Math.round(paidRevenue / Math.max(1, todays.length)) : 0,
    revenueChange,
  };
}

export interface DayPoint {
  date: Date;
  label: string;
  revenue: number;
  orders: number;
}

export function revenueSeries(db: Database, days = 14): DayPoint[] {
  const points: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    const dayOrders = db.orders.filter(
      (o) => isSameDay(o.createdAt, date) && o.status !== "cancelled",
    );
    points.push({
      date,
      label: date.toLocaleDateString("en-KE", { weekday: "short" }),
      // Money actually collected: settled orders plus COD that has been delivered.
      revenue: dayOrders
        .filter(
          (o) =>
            o.paymentStatus === "paid" ||
            (o.paymentStatus === "cod" && o.status === "delivered"),
        )
        .reduce((sum, o) => sum + sellerReceives(o), 0),
      orders: dayOrders.length,
    });
  }
  return points;
}

export function channelBreakdown(db: Database, days = 30) {
  const cutoff = Date.now() - days * 86400000;
  const totals = new Map<string, { revenue: number; orders: number }>();
  db.orders
    .filter((o) => +new Date(o.createdAt) >= cutoff && o.status !== "cancelled")
    .forEach((o) => {
      const current = totals.get(o.channel) ?? { revenue: 0, orders: 0 };
      totals.set(o.channel, {
        revenue: current.revenue + sellerReceives(o),
        orders: current.orders + 1,
      });
    });
  return [...totals.entries()]
    .map(([channel, v]) => ({ channel: channel as Order["channel"], ...v }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function topProducts(db: Database, limit = 5) {
  const totals = new Map<string, { product: Product; qty: number; revenue: number }>();
  db.orders
    .filter((o) => o.status !== "cancelled")
    .forEach((o) =>
      o.items.forEach((it) => {
        const product = db.products.find((p) => p.id === it.productId);
        if (!product) return;
        const current = totals.get(it.productId) ?? { product, qty: 0, revenue: 0 };
        totals.set(it.productId, {
          product,
          qty: current.qty + it.qty,
          revenue: current.revenue + it.price * it.qty,
        });
      }),
    );
  return [...totals.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

export function customerStats(db: Database, customerId: string) {
  const orders = db.orders.filter((o) => o.customerId === customerId && o.status !== "cancelled");
  const spent = orders.reduce((sum, o) => sum + sellerReceives(o), 0);
  const owed = orders
    .filter((o) => o.paymentStatus === "unpaid" || o.paymentStatus === "cod")
    .reduce((sum, o) => sum + sellerReceives(o), 0);
  return {
    orders: orders.length,
    spent,
    owed,
    lastOrderAt: orders[0]?.createdAt,
    averageOrder: orders.length ? Math.round(spent / orders.length) : 0,
  };
}

export function unmatchedPayments(db: Database) {
  return db.payments.filter((p) => !p.matched && p.state !== "failed");
}

export function needsReviewCount(db: Database) {
  return (
    db.captures.filter((c) => c.status === "needs_review").length + unmatchedPayments(db).length
  );
}

export function unreadCount(db: Database) {
  return db.conversations.reduce((sum, c) => sum + c.unread, 0);
}

export function lowStock(db: Database) {
  return db.products.filter((p) => p.stock <= p.lowStockAt);
}

export function ledgerTotals(db: Database, days = 30) {
  const cutoff = Date.now() - days * 86400000;
  const entries = db.ledger.filter((e) => +new Date(e.date) >= cutoff);
  const income = entries.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const expenses = entries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  return { income, expenses, net: income - expenses, unreconciled: entries.filter((e) => !e.reconciled).length };
}

export interface PeriodComparison {
  value: number;
  previous: number;
  change: number;
  delta: number;
}

function compare(value: number, previous: number): PeriodComparison {
  return {
    value,
    previous,
    change: value - previous,
    delta: previous > 0 ? ((value - previous) / previous) * 100 : 0,
  };
}

/** This 30-day window against the one before it — what the stat cards report. */
export function monthOverMonth(db: Database) {
  const now = Date.now();
  const thisStart = now - 30 * 86400000;
  const lastStart = now - 60 * 86400000;

  const inWindow = (iso: string, from: number, to: number) => {
    const at = +new Date(iso);
    return at >= from && at < to;
  };

  const live = db.orders.filter((o) => o.status !== "cancelled");
  const thisOrders = live.filter((o) => inWindow(o.createdAt, thisStart, now));
  const lastOrders = live.filter((o) => inWindow(o.createdAt, lastStart, thisStart));

  const collected = (list: Order[]) =>
    list
      .filter(
        (o) =>
          o.paymentStatus === "paid" || (o.paymentStatus === "cod" && o.status === "delivered"),
      )
      .reduce((sum, o) => sum + sellerReceives(o), 0);

  const expenses = (from: number, to: number) =>
    db.ledger
      .filter((e) => e.type === "expense" && inWindow(e.date, from, to))
      .reduce((sum, e) => sum + e.amount, 0);

  return {
    revenue: compare(collected(thisOrders), collected(lastOrders)),
    orders: compare(thisOrders.length, lastOrders.length),
    delivered: compare(
      thisOrders.filter((o) => o.status === "delivered").length,
      lastOrders.filter((o) => o.status === "delivered").length,
    ),
    spending: compare(expenses(thisStart, now), expenses(lastStart, thisStart)),
  };
}

/** Income against spending, week by week, for the grouped chart. */
export function weeklyIncomeVsSpending(db: Database, weeks = 8) {
  const out: { label: string; a: number; b: number }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    end.setDate(end.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    const within = (iso: string) => {
      const at = +new Date(iso);
      return at >= +start && at <= +end;
    };

    out.push({
      label: start.toLocaleDateString("en-KE", { day: "numeric", month: "short" }),
      a: db.ledger
        .filter((e) => e.type === "income" && within(e.date))
        .reduce((sum, e) => sum + e.amount, 0),
      b: db.ledger
        .filter((e) => e.type === "expense" && within(e.date))
        .reduce((sum, e) => sum + e.amount, 0),
    });
  }
  return out;
}

/** Daily expense totals, so the spending card plots spending. */
export function expenseSeries(db: Database, days = 7) {
  const points: { label: string; value: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    points.push({
      label: date.toLocaleDateString("en-KE", { weekday: "short" }),
      value: db.ledger
        .filter((e) => e.type === "expense" && isSameDay(e.date, date))
        .reduce((sum, e) => sum + e.amount, 0),
    });
  }
  return points;
}

/** What went out today, for the dashboard's spending card. */
export function todayExpenses(db: Database) {
  const today = new Date();
  return db.ledger
    .filter((e) => e.type === "expense" && isSameDay(e.date, today))
    .reduce((sum, e) => sum + e.amount, 0);
}

/** Customers to surface in Quick Send: most recent first, then biggest. */
export function quickSendCustomers(db: Database, limit = 6) {
  const lastOrderAt = new Map<string, number>();
  db.orders.forEach((o) => {
    const at = +new Date(o.createdAt);
    if (at > (lastOrderAt.get(o.customerId) ?? 0)) lastOrderAt.set(o.customerId, at);
  });
  return [...db.customers]
    .sort((a, b) => (lastOrderAt.get(b.id) ?? 0) - (lastOrderAt.get(a.id) ?? 0))
    .slice(0, limit);
}

/** The one-line "smart insight" the dashboard leads with. Always explainable. */
export function smartInsight(db: Database): { text: string; detail: string } {
  const series = revenueSeries(db, 14);
  const thisWeek = series.slice(7);
  const lastWeek = series.slice(0, 7);
  const thisWeekOrders = thisWeek.reduce((s, d) => s + d.orders, 0);
  const lastWeekOrders = lastWeek.reduce((s, d) => s + d.orders, 0);
  const thisWeekRevenue = thisWeek.reduce((s, d) => s + d.revenue, 0);
  const lastWeekRevenue = lastWeek.reduce((s, d) => s + d.revenue, 0);

  const aovThis = thisWeekOrders ? thisWeekRevenue / thisWeekOrders : 0;
  const aovLast = lastWeekOrders ? lastWeekRevenue / lastWeekOrders : 0;

  const unmatched = unmatchedPayments(db);
  if (unmatched.length >= 3) {
    const total = unmatched.reduce((s, p) => s + p.amount, 0);
    return {
      text: `We found ${unmatched.length} payments that haven't been matched.`,
      detail: `KES ${Math.round(total).toLocaleString("en-KE")} is sitting outside your ledger. Match them to close the week clean.`,
    };
  }

  const short = lowStock(db);
  if (short.length) {
    return {
      text: `${short.length} ${short.length === 1 ? "product is" : "products are"} running low.`,
      detail: `${short.map((p) => p.name).slice(0, 2).join(", ")}${short.length > 2 ? ` and ${short.length - 2} more` : ""} — restock before the weekend rush.`,
    };
  }

  if (aovLast > 0) {
    const change = ((aovThis - aovLast) / aovLast) * 100;
    return {
      text: `Your average order value is ${change >= 0 ? "up" : "down"} ${Math.abs(change).toFixed(0)}% this week.`,
      detail: `KES ${Math.round(aovThis).toLocaleString("en-KE")} per order, from KES ${Math.round(aovLast).toLocaleString("en-KE")} last week.`,
    };
  }

  return {
    text: "Your books are up to date.",
    detail: "Every payment this week is matched to an order.",
  };
}

/* ------------------------------------------------------------------ *
 * The rider float.
 *
 * When a rider collects the goods money at the door, that cash is the
 * seller's — it is just in someone else's pocket until they hand it over. It
 * is the single easiest thing for a small business to lose track of, because
 * nothing in the phone shows it: the order looks paid and the money is not
 * there. So it is counted explicitly.
 * ------------------------------------------------------------------ */

export function outstandingRiderCash(db: Database) {
  return db.deliveries.filter((d) => d.cashCollected && !d.remittedAt);
}

export function riderFloat(db: Database) {
  return outstandingRiderCash(db).reduce((sum, d) => sum + (d.cashCollected ?? 0), 0);
}

/** What each rider is holding, most first. */
export function riderFloatByRider(db: Database) {
  const totals = new Map<string, number>();
  outstandingRiderCash(db).forEach((d) => {
    totals.set(d.riderId, (totals.get(d.riderId) ?? 0) + (d.cashCollected ?? 0));
  });
  return [...totals.entries()]
    .map(([riderId, amount]) => ({
      rider: db.riders.find((r) => r.id === riderId),
      amount,
      trips: outstandingRiderCash(db).filter((d) => d.riderId === riderId).length,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/** Deliveries where the rider is at the door waiting on a payment confirmation. */
export function awaitingPayment(db: Database) {
  return db.deliveries.filter((d) => d.status === "awaiting_payment");
}

/**
 * Delivery fees the seller never sees, because the customer pays the boda
 * directly. Worth showing precisely because it is not revenue: it is what the
 * seller's customers are paying on top, which shapes what they will bear.
 */
export function feesPaidDirectToRiders(db: Database, days = 30) {
  const cutoff = Date.now() - days * 86400000;
  return db.orders
    .filter(
      (o) =>
        o.status !== "cancelled" &&
        settlementOf(o) === "customer_pays_rider" &&
        +new Date(o.createdAt) >= cutoff,
    )
    .reduce((sum, o) => sum + o.deliveryFee, 0);
}
