import type { Database, OrderItem, Product, SerialUnit } from "./types";
import { serialStockCount } from "./serials";

/**
 * The till.
 *
 * Selling across a counter is a different job from taking an order on
 * Instagram, and the difference is time. An order can be corrected before it
 * ships; a counter sale is finished when the customer walks out of the door. So
 * the arithmetic here has to be right the first time, in front of somebody
 * waiting, and every function in this file is written to be checkable without a
 * browser for exactly that reason.
 *
 * What the till must never do is guess. If there is not enough stock it says
 * so; if a serialised item has no unit chosen it refuses; if the cash handed
 * over does not cover the bill it does not quietly round. A shopkeeper can
 * recover from a screen that says no. They cannot recover from a screen that
 * says yes and is wrong.
 */

export interface CartLine {
  productId: string;
  name: string;
  /**
   * What was actually agreed, per unit.
   *
   * Not the price on the shelf. In most of this market the shelf price is an
   * opening position — a 14,500 phone leaves at 13,000 and everyone considers
   * that a normal Tuesday. Storing the list price and calling the difference a
   * "discount" applied afterwards gets two things wrong at once: the receipt
   * shows a number the customer did not pay, and the payment that arrives never
   * matches the order it belongs to.
   *
   * So the agreed price is the price. What the shelf said is kept beside it,
   * because the gap between the two is worth knowing.
   */
  price: number;
  /** What the product is listed at, when it differs from what was agreed. */
  listPrice?: number;
  qty: number;
  /** Which exact units are leaving, for serialised stock. */
  serialIds?: string[];
  /** Unit cost, carried so the till can say when a haggle has gone too far. */
  cost?: number;
}

export interface CartTotals {
  /** How many things, not how many lines. */
  count: number;
  goods: number;
  discount: number;
  total: number;
}

export function cartTotals(lines: CartLine[], discount = 0): CartTotals {
  const goods = lines.reduce((sum, line) => sum + line.price * line.qty, 0);
  // A discount never turns a sale into money owed to the customer.
  const capped = Math.min(Math.max(0, discount), goods);
  return {
    count: lines.reduce((sum, line) => sum + line.qty, 0),
    goods,
    discount: capped,
    total: goods - capped,
  };
}

/* ------------------------------------------------------------------ *
 * Bargaining
 * ------------------------------------------------------------------ */

export interface Bargain {
  /** What the shelf said, in total. */
  listed: number;
  /** What was agreed. */
  agreed: number;
  /** How much was given away. Zero when nothing was negotiated. */
  given: number;
  /** As a share of the listed price, for a seller judging whether it was much. */
  percent: number;
  negotiated: boolean;
}

/** What the haggling on this cart came to. */
export function bargainOn(lines: CartLine[]): Bargain {
  const listed = lines.reduce((sum, l) => sum + (l.listPrice ?? l.price) * l.qty, 0);
  const agreed = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const given = Math.max(0, listed - agreed);
  return {
    listed,
    agreed,
    given,
    percent: listed > 0 ? given / listed : 0,
    negotiated: given > 0,
  };
}

export type PriceVerdict =
  | { level: "fine" }
  | { level: "thin"; margin: number; message: string }
  | { level: "under_cost"; margin: number; message: string };

/**
 * What a negotiated price does to the money on this line.
 *
 * Never refuses. A seller who has decided to take a loss on a phone to move it
 * before the model turns over is making a business decision, and a till that
 * blocks them is a till they will work around. It says the number out loud
 * instead, at the moment it can still change the answer — which is the whole
 * value of saying it at all.
 *
 * "Thin" is set at a tenth of the price rather than a fixed shilling amount,
 * because ten percent means something different on a 900 head wrap and a 45,000
 * television, and only one of those two is worth interrupting somebody for.
 */
export function priceVerdict(price: number, cost?: number): PriceVerdict {
  if (cost === undefined || cost <= 0) return { level: "fine" };

  const margin = price - cost;
  if (margin < 0) {
    return {
      level: "under_cost",
      margin,
      message: `That is ${formatShort(Math.abs(margin))} below what it cost you.`,
    };
  }
  if (margin < price * 0.1) {
    return {
      level: "thin",
      margin,
      message: `Leaves you ${formatShort(margin)} on this one.`,
    };
  }
  return { level: "fine" };
}

/** Bare number formatting, so this file needs nothing from the UI layer. */
function formatShort(value: number) {
  return `KES ${Math.round(value).toLocaleString("en-KE")}`;
}

/**
 * The prices a seller is most likely to settle on.
 *
 * Haggling in this market moves in round steps, and which step depends on the
 * size of the number: a hundred off a 900 shilling wrap is a different
 * conversation from a hundred off a 45,000 television. The suggestions follow
 * the price rather than being a fixed ladder, so the useful button is always
 * the one under the thumb.
 */
export function bargainSuggestions(listPrice: number): number[] {
  if (listPrice <= 0) return [];
  const step =
    listPrice >= 20000 ? 1000 : listPrice >= 5000 ? 500 : listPrice >= 1500 ? 100 : 50;

  return [1, 2, 3]
    .map((n) => listPrice - step * n)
    // Never suggests giving the thing away, and never suggests a price the
    // seller would have to explain to themselves later.
    .filter((price) => price >= Math.max(1, listPrice * 0.5));
}

export function toOrderItems(lines: CartLine[]): OrderItem[] {
  return lines.map((line) => ({
    productId: line.productId,
    name: line.name,
    qty: line.qty,
    price: line.price,
    // Only carried when it differs, so an ordinary sale does not store a field
    // that merely repeats the price.
    ...(line.listPrice !== undefined && line.listPrice !== line.price
      ? { listPrice: line.listPrice }
      : {}),
  }));
}

export function serialIdsIn(lines: CartLine[]) {
  return lines.flatMap((line) => line.serialIds ?? []);
}

/* ------------------------------------------------------------------ *
 * Cash
 * ------------------------------------------------------------------ */

export interface CashOutcome {
  /** What to hand back. Zero when the amount is exact. */
  change: number;
  /** What is still owed, when the customer is short. */
  short: number;
  enough: boolean;
}

/**
 * Change for cash.
 *
 * The one sum a till is judged on, and the one a tired person gets wrong at
 * six in the evening. Short payments are reported rather than rejected: a
 * customer paying part now and the rest on Friday is ordinary here, and the
 * shopkeeper — not this function — decides whether that is acceptable.
 */
export function cashOutcome(total: number, tendered: number): CashOutcome {
  const change = Math.max(0, tendered - total);
  const short = Math.max(0, total - tendered);
  return { change, short, enough: tendered >= total };
}

/**
 * The notes a customer is most likely to hand over for this bill.
 *
 * Kenyan notes are 50, 100, 200, 500 and 1,000. Offering the exact amount plus
 * the obvious round-ups saves the most common interaction at a counter, which
 * is not typing a number — it is confirming the one already in front of you.
 */
export function tenderSuggestions(total: number): number[] {
  if (total <= 0) return [];
  const notes = [50, 100, 200, 500, 1000];
  const out = new Set<number>([total]);

  // The smallest single note that covers it, then the next two round steps up.
  for (const note of notes) if (note >= total) out.add(note);

  const step = total > 1000 ? 500 : 100;
  const rounded = Math.ceil(total / step) * step;
  out.add(rounded);
  out.add(rounded + step);

  return [...out].filter((n) => n >= total).sort((a, b) => a - b).slice(0, 4);
}

/* ------------------------------------------------------------------ *
 * What can actually be sold
 * ------------------------------------------------------------------ */

export type SellBlock =
  | { ok: true }
  | { ok: false; reason: "out_of_stock" | "not_enough" | "needs_serial"; available: number; message: string };

/** Units of a serialised product still in the shop. */
export function availableSerials(db: Database, productId: string): SerialUnit[] {
  return db.serials.filter((unit) => unit.productId === productId && unit.status === "in_stock");
}

/**
 * How many of this product the shop can actually hand over right now.
 *
 * Counted the way the product is counted: a serialised product from its units,
 * a service not at all, everything else from its stock figure.
 */
export function sellableCount(db: Database, product: Product): number {
  if (product.stockMode === "service") return Infinity;
  if (product.stockMode === "serial") return serialStockCount(db, product);
  return product.stock;
}

/**
 * Whether one more of this product can go into the cart.
 *
 * `inCart` is passed in rather than read from anywhere, because the cart is the
 * screen's business and this function has no opinion about where it lives.
 */
export function canSell(db: Database, product: Product, inCart: number): SellBlock {
  if (product.stockMode === "service") return { ok: true };

  const available = sellableCount(db, product);

  if (product.stockMode === "serial") {
    if (available <= 0) {
      return {
        ok: false,
        reason: "out_of_stock",
        available: 0,
        message: `No ${product.name} left in stock.`,
      };
    }
    if (inCart >= available) {
      return {
        ok: false,
        reason: "not_enough",
        available,
        message:
          available === 1
            ? `Only one ${product.name} left, and it is already in this sale.`
            : `Only ${available} ${product.name} in stock.`,
      };
    }
    return { ok: true };
  }

  if (available <= 0) {
    return {
      ok: false,
      reason: "out_of_stock",
      available: 0,
      message: `${product.name} is out of stock.`,
    };
  }
  if (inCart >= available) {
    return {
      ok: false,
      reason: "not_enough",
      available,
      message: `Only ${available} ${product.name} in stock.`,
    };
  }
  return { ok: true };
}

/**
 * Anything stopping this cart being rung up.
 *
 * Returns every problem rather than the first, so a shopkeeper fixes the sale
 * once instead of discovering the next objection after each correction.
 */
export function blockers(db: Database, lines: CartLine[]): string[] {
  const problems: string[] = [];

  for (const line of lines) {
    const product = db.products.find((p) => p.id === line.productId);
    if (!product) {
      problems.push(`${line.name} is no longer in your products.`);
      continue;
    }

    if (product.stockMode === "serial") {
      // Selling a phone means naming the handset. Without that, the shop cannot
      // say later which unit went out, and the warranty belongs to nobody.
      const chosen = line.serialIds?.length ?? 0;
      if (chosen < line.qty) {
        problems.push(
          `Choose which ${line.name} ${line.qty > 1 ? "units are" : "is"} leaving — ${chosen} of ${line.qty} picked.`,
        );
      }
      continue;
    }

    if (product.stockMode === "service") continue;

    if (line.qty > product.stock) {
      problems.push(`Only ${product.stock} ${line.name} in stock, ${line.qty} in this sale.`);
    }
  }

  return problems;
}

/* ------------------------------------------------------------------ *
 * What the haggling costs
 * ------------------------------------------------------------------ */

export interface BargainReport {
  /** Sales where something came off the asking price. */
  sales: number;
  /** Every sale in the window, for the share below. */
  total: number;
  /** What was given away, in shillings. */
  given: number;
  /** The share of sales that involved a negotiation. */
  rate: number;
  /** Average shave, as a share of the listed price, on the sales that moved. */
  averageCut: number;
  /** The items most often talked down, worst first. */
  worst: { productId: string; name: string; times: number; given: number; averageCut: number }[];
}

/**
 * What bargaining cost over a period.
 *
 * Worth surfacing because it is invisible one sale at a time. Two hundred
 * shillings off a phone feels like nothing at the counter and is the month's
 * profit by the thirtieth. This is not an argument against haggling — it is how
 * business is done here — but a seller who knows the number can decide where to
 * hold, and can price with the negotiation already built in.
 */
export function bargainReport(db: Database, days = 30, now = new Date()): BargainReport {
  const cutoff = +now - days * 86_400_000;
  const orders = db.orders.filter(
    (o) => o.status !== "cancelled" && +new Date(o.createdAt) >= cutoff,
  );

  const byProduct = new Map<
    string,
    { productId: string; name: string; times: number; given: number; listed: number }
  >();

  let given = 0;
  let listedOnCut = 0;
  let negotiated = 0;

  for (const order of orders) {
    let orderGiven = 0;
    let orderListed = 0;

    for (const item of order.items) {
      if (item.listPrice === undefined || item.listPrice <= item.price) continue;
      const cut = (item.listPrice - item.price) * item.qty;
      orderGiven += cut;
      orderListed += item.listPrice * item.qty;

      const row = byProduct.get(item.productId) ?? {
        productId: item.productId,
        name: item.name,
        times: 0,
        given: 0,
        listed: 0,
      };
      row.times += 1;
      row.given += cut;
      row.listed += item.listPrice * item.qty;
      byProduct.set(item.productId, row);
    }

    if (orderGiven > 0) {
      negotiated += 1;
      given += orderGiven;
      listedOnCut += orderListed;
    }
  }

  return {
    sales: negotiated,
    total: orders.length,
    given,
    rate: orders.length ? negotiated / orders.length : 0,
    averageCut: listedOnCut ? given / listedOnCut : 0,
    worst: [...byProduct.values()]
      .map((row) => ({
        productId: row.productId,
        name: row.name,
        times: row.times,
        given: row.given,
        averageCut: row.listed ? row.given / row.listed : 0,
      }))
      .sort((a, b) => b.given - a.given)
      .slice(0, 5),
  };
}

/* ------------------------------------------------------------------ *
 * The day at the till
 * ------------------------------------------------------------------ */

export interface TillDay {
  sales: number;
  takings: number;
  cash: number;
  mpesa: number;
  /** Handed over without being paid for. */
  owed: number;
}

/**
 * What the till did today.
 *
 * Cash and M-Pesa are kept apart because they are reconciled apart: one is
 * counted in a drawer at closing, the other against a statement. Adding them
 * into a single "takings" figure and stopping there is how a shop discovers a
 * shortfall a week late with no idea which half it came from.
 */
export function tillToday(db: Database, now = new Date()): TillDay {
  const sameDay = (iso: string) => {
    const d = new Date(iso);
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  };

  const counter = db.orders.filter((o) => o.channel === "walk-in" && sameDay(o.createdAt));
  const ids = new Set(counter.map((o) => o.id));
  const payments = db.payments.filter(
    (p) => p.orderId && ids.has(p.orderId) && p.state === "received",
  );

  const takings = payments.reduce((sum, p) => sum + p.amount, 0);
  const billed = counter.reduce(
    (sum, o) => sum + o.items.reduce((s, i) => s + i.price * i.qty, 0) - o.discount,
    0,
  );

  return {
    sales: counter.length,
    takings,
    cash: payments.filter((p) => p.method === "cash").reduce((s, p) => s + p.amount, 0),
    mpesa: payments.filter((p) => p.method === "mpesa").reduce((s, p) => s + p.amount, 0),
    owed: Math.max(0, billed - takings),
  };
}
