import type { Database, Product, SerialUnit } from "./types";

/**
 * Serialised stock.
 *
 * A phone shop does not have "four power banks" — it has four specific power
 * banks, each with its own serial, its own buying price and its own warranty
 * clock. Stock is therefore counted, never typed: it is the number of units
 * whose status is in_stock. Cost is the real cost of the real units, so a batch
 * bought at a worse price shows up as a worse margin instead of hiding inside
 * an averaged cost field.
 */

export interface SerialSummary {
  inStock: SerialUnit[];
  sold: SerialUnit[];
  faulty: SerialUnit[];
  returned: SerialUnit[];
  /** What the units on the shelf cost to buy. */
  stockValue: number;
  /** Average cost of what is on the shelf, or null when nothing is. */
  averageCost: number | null;
  /** Money tied up in units that cannot be sold as they are. */
  deadStock: number;
}

export function unitsOf(db: Database, productId: string) {
  return db.serials.filter((unit) => unit.productId === productId);
}

export function summariseSerials(units: SerialUnit[]): SerialSummary {
  const by = (status: SerialUnit["status"]) => units.filter((u) => u.status === status);
  const inStock = by("in_stock");
  const faulty = by("faulty");
  const stockValue = inStock.reduce((sum, u) => sum + u.cost, 0);
  return {
    inStock,
    sold: by("sold"),
    faulty,
    returned: by("returned"),
    stockValue,
    averageCost: inStock.length ? stockValue / inStock.length : null,
    deadStock: faulty.reduce((sum, u) => sum + u.cost, 0),
  };
}

/** Products tracked unit by unit, with their units summarised. */
export function serialisedProducts(db: Database) {
  return db.products
    .filter((product) => product.stockMode === "serial")
    .map((product) => ({ product, summary: summariseSerials(unitsOf(db, product.id)) }));
}

/**
 * Whether a sold unit is still covered, and for how long. Warranty is a promise
 * the seller made; knowing when it lapses is the difference between honouring
 * it and arguing about it.
 */
export function warrantyStatus(unit: SerialUnit, now = Date.now()) {
  if (unit.status !== "sold" || !unit.soldAt || !unit.warrantyMonths) return null;
  const expires = new Date(unit.soldAt);
  expires.setMonth(expires.getMonth() + unit.warrantyMonths);
  const daysLeft = Math.ceil((+expires - now) / 86400000);
  return { expires: expires.toISOString(), daysLeft, covered: daysLeft > 0 };
}

/** Sold units still under warranty, soonest to lapse first. */
export function underWarranty(db: Database) {
  return db.serials
    .map((unit) => ({ unit, warranty: warrantyStatus(unit) }))
    .filter(
      (row): row is { unit: SerialUnit; warranty: NonNullable<ReturnType<typeof warrantyStatus>> } =>
        row.warranty !== null && row.warranty.covered,
    )
    .sort((a, b) => a.warranty.daysLeft - b.warranty.daysLeft);
}

export function serialStockValue(db: Database) {
  return db.serials
    .filter((unit) => unit.status === "in_stock")
    .reduce((sum, unit) => sum + unit.cost, 0);
}

/** The count that should be shown as stock for a serialised product. */
export function serialStockCount(db: Database, product: Product) {
  return unitsOf(db, product.id).filter((unit) => unit.status === "in_stock").length;
}
