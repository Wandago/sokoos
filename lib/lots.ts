import type { Database, Lot, LotGrade, Product } from "./types";

/**
 * Lot costing — what one piece out of a bale actually cost.
 *
 * A trader pays KES 24,500 for a bale, KES 1,800 to get it to the shop, and
 * KES 3,100 to sort, press and mend it. That KES 29,400 landed cost has to be
 * spread across whatever came out. Dividing by the piece count is the obvious
 * move and the wrong one: it says a Grade A dress that sells for 2,500 cost the
 * same as a Grade C top that sells for 450, which makes the good stock look
 * unprofitable and the bad stock look like a winner.
 *
 * The standard treatment for a joint cost across outputs of unequal value is to
 * allocate it by relative sales value, so each grade carries a share of the
 * cost proportional to the money it can bring in. An even split is still
 * offered, because when a carton holds 48 identical jars it is the honest
 * answer.
 */

export interface CostedGrade {
  grade: LotGrade;
  /** This grade's share of the landed cost. */
  allocatedCost: number;
  costPerUnit: number;
  /** What the whole grade would bring in if it all sold at its price. */
  salesValue: number;
  marginPerUnit: number;
  marginPercent: number;
  remaining: number;
}

export interface CostedLot {
  lot: Lot;
  extras: number;
  /** Purchase price plus everything spent getting it ready to sell. */
  landedCost: number;
  units: number;
  grades: CostedGrade[];
  /** Money already taken from this lot, at each grade's price. */
  recovered: number;
  /** What the unsold remainder would bring in at today's prices. */
  remainingValue: number;
  /** Recovered plus remaining, against what it cost. */
  projectedProfit: number;
  /** True once takings alone have covered the landed cost. */
  paidBack: boolean;
  /** How many more pieces must sell to cover what is left of the landed cost. */
  unitsToBreakEven: number;
}

export function lotExtras(lot: Lot) {
  return lot.extraCosts.reduce((sum, cost) => sum + cost.amount, 0);
}

export function landedCost(lot: Lot) {
  return lot.purchasePrice + lotExtras(lot);
}

export function costLot(lot: Lot): CostedLot {
  const extras = lotExtras(lot);
  const landed = lot.purchasePrice + extras;
  const units = lot.grades.reduce((sum, g) => sum + g.units, 0);
  const totalValue = lot.grades.reduce((sum, g) => sum + g.units * g.unitPrice, 0);

  const grades: CostedGrade[] = lot.grades.map((grade) => {
    const salesValue = grade.units * grade.unitPrice;
    const share =
      lot.allocation === "by_value"
        ? totalValue > 0
          ? salesValue / totalValue
          : 0
        : units > 0
          ? grade.units / units
          : 0;
    const allocatedCost = landed * share;
    const costPerUnit = grade.units > 0 ? allocatedCost / grade.units : 0;
    const marginPerUnit = grade.unitPrice - costPerUnit;
    return {
      grade,
      allocatedCost,
      costPerUnit,
      salesValue,
      marginPerUnit,
      marginPercent: grade.unitPrice > 0 ? (marginPerUnit / grade.unitPrice) * 100 : 0,
      remaining: Math.max(0, grade.units - grade.sold),
    };
  });

  const recovered = grades.reduce((sum, g) => sum + g.grade.sold * g.grade.unitPrice, 0);
  const remainingValue = grades.reduce((sum, g) => sum + g.remaining * g.grade.unitPrice, 0);

  // What is still to be earned back, and how many more pieces that takes at the
  // average price of what is left on the shelf.
  const outstanding = Math.max(0, landed - recovered);
  const remainingUnits = grades.reduce((sum, g) => sum + g.remaining, 0);
  const averagePrice = remainingUnits > 0 ? remainingValue / remainingUnits : 0;

  return {
    lot,
    extras,
    landedCost: landed,
    units,
    grades,
    recovered,
    remainingValue,
    projectedProfit: recovered + remainingValue - landed,
    paidBack: recovered >= landed,
    unitsToBreakEven: averagePrice > 0 ? Math.ceil(outstanding / averagePrice) : 0,
  };
}

export function costedLots(db: Database) {
  return db.lots
    .map(costLot)
    .sort((a, b) => +new Date(b.lot.purchasedAt) - +new Date(a.lot.purchasedAt));
}

/** What one unit of a lot-tracked product cost, from its grade's allocation. */
export function lotUnitCost(product: Product, db: Database): number | null {
  if (!product.lotId) return null;
  const lot = db.lots.find((l) => l.id === product.lotId);
  if (!lot) return null;
  const costed = costLot(lot);
  const grade = costed.grades.find(
    (g) => g.grade.id === product.gradeId || g.grade.productId === product.id,
  );
  return grade ? grade.costPerUnit : null;
}

/** Lots whose takings have not yet covered what they cost. */
export function lotsNotPaidBack(db: Database) {
  return costedLots(db).filter((lot) => !lot.paidBack);
}

export function lotStockValue(db: Database) {
  return costedLots(db).reduce(
    (sum, lot) => sum + lot.grades.reduce((s, g) => s + g.remaining * g.costPerUnit, 0),
    0,
  );
}
