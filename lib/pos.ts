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
  price: number;
  qty: number;
  /** Which exact units are leaving, for serialised stock. */
  serialIds?: string[];
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

export function toOrderItems(lines: CartLine[]): OrderItem[] {
  return lines.map((line) => ({
    productId: line.productId,
    name: line.name,
    qty: line.qty,
    price: line.price,
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
