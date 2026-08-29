import { isSameDay } from "./format";
import type { Customer, Database, Order, Product, Rider } from "./types";

/** Timestamp `days` before now — kept out of render memos, which must be pure. */
export function daysAgoCutoff(days: number) {
  return Date.now() - days * 86400000;
}

export function orderSubtotal(order: Order) {
  return order.items.reduce((sum, it) => sum + it.price * it.qty, 0);
}

export function orderTotal(order: Order) {
  return orderSubtotal(order) + order.deliveryFee - order.discount;
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
    .reduce((sum, o) => sum + (o.paymentStatus === "partial" ? orderTotal(o) / 2 : orderTotal(o)), 0);

  const yesterdayRevenue = yesterdays
    .filter((o) => o.paymentStatus === "paid")
    .reduce((sum, o) => sum + orderTotal(o), 0);

  const unpaid = todays
    .filter((o) => o.paymentStatus === "unpaid" || o.paymentStatus === "cod")
    .reduce((sum, o) => sum + orderTotal(o), 0);

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
        .reduce((sum, o) => sum + orderTotal(o), 0),
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
        revenue: current.revenue + orderTotal(o),
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
  const spent = orders.reduce((sum, o) => sum + orderTotal(o), 0);
  const owed = orders
    .filter((o) => o.paymentStatus === "unpaid" || o.paymentStatus === "cod")
    .reduce((sum, o) => sum + orderTotal(o), 0);
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
