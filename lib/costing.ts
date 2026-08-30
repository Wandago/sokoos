import type { Database, Ingredient, Product, RecipeLine, StockMode, Unit } from "./types";
import { unitFactor } from "./types";
import { lotStockValue, lotUnitCost } from "./lots";
import { serialStockValue, summariseSerials, unitsOf } from "./serials";

/**
 * Recipe costing.
 *
 * A "cost price" field is a guess. This works the way a kitchen does: every
 * product that is produced carries a bill of materials, each line is converted
 * to the ingredient's base unit, wastage is added where it is real, and the
 * cost falls out of the arithmetic. Change the price of flour and every cake
 * reprices itself.
 */

export interface CostedLine {
  line: RecipeLine;
  ingredient?: Ingredient;
  /** Quantity in the ingredient's base unit, wastage included. */
  baseQty: number;
  cost: number;
  /** How many units of this product the remaining stock could make. */
  makeable: number;
}

export interface ProductCost {
  lines: CostedLine[];
  /** Cost of one unit, in KES. */
  unitCost: number;
  margin: number;
  marginPercent: number;
  /** How many can be made from what is in the store right now. */
  makeable: number;
  /** The line that runs out first. */
  limitedBy?: Ingredient;
  /** Lines whose ingredient has gone missing from the store. */
  missing: RecipeLine[];
}

/** Converts a recipe quantity into the ingredient's base unit, plus wastage. */
export function toBaseQty(line: RecipeLine) {
  const wastage = 1 + (line.wastagePercent ?? 0) / 100;
  return line.qty * unitFactor[line.unit] * wastage;
}

export function costProduct(product: Product, ingredients: Ingredient[]): ProductCost | null {
  if (!product.recipe?.length) return null;

  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const missing: RecipeLine[] = [];

  const lines: CostedLine[] = product.recipe.map((line) => {
    const ingredient = byId.get(line.ingredientId);
    if (!ingredient) missing.push(line);
    const baseQty = toBaseQty(line);
    return {
      line,
      ingredient,
      baseQty,
      cost: ingredient ? baseQty * ingredient.costPerUnit : 0,
      makeable: ingredient && baseQty > 0 ? Math.floor(ingredient.stock / baseQty) : Infinity,
    };
  });

  const unitCost = lines.reduce((sum, l) => sum + l.cost, 0);
  const margin = product.price - unitCost;

  // The batch is capped by whichever ingredient runs out first.
  const constrained = lines.filter((l) => Number.isFinite(l.makeable));
  const makeable = constrained.length
    ? Math.max(0, Math.min(...constrained.map((l) => l.makeable)))
    : 0;
  const limitedBy = constrained.find((l) => l.makeable === makeable)?.ingredient;

  return {
    lines,
    unitCost,
    margin,
    marginPercent: product.price > 0 ? (margin / product.price) * 100 : 0,
    makeable,
    limitedBy,
    missing,
  };
}

/** Every produced product, costed, worst margin first. */
export function costedProducts(db: Database) {
  return db.products
    .map((product) => ({ product, cost: costProduct(product, db.ingredients) }))
    .filter((row): row is { product: Product; cost: ProductCost } => row.cost !== null)
    .sort((a, b) => a.cost.marginPercent - b.cost.marginPercent);
}

/** What one unit of a product consumes, ingredient by ingredient. */
export function ingredientDraw(product: Product, quantity: number) {
  if (!product.recipe?.length) return [];
  return product.recipe.map((line) => ({
    ingredientId: line.ingredientId,
    baseQty: toBaseQty(line) * quantity,
  }));
}

export function stockValue(ingredients: Ingredient[]) {
  return ingredients.reduce((sum, i) => sum + i.stock * i.costPerUnit, 0);
}

export function lowIngredients(ingredients: Ingredient[]) {
  return ingredients.filter((i) => i.stock <= i.lowStockAt);
}

/** Human-readable quantity: 0.4 kg reads better as 400 g. */
export function formatQty(qty: number, unit: Unit) {
  if (unit === "piece") {
    return `${qty % 1 === 0 ? qty : qty.toFixed(1)} ${qty === 1 ? "piece" : "pieces"}`;
  }
  if (unit === "kg" && qty < 1) return `${Math.round(qty * 1000)} g`;
  if (unit === "l" && qty < 1) return `${Math.round(qty * 1000)} ml`;
  return `${qty % 1 === 0 ? qty : qty.toFixed(2)} ${unit}`;
}

export function formatLineQty(line: RecipeLine) {
  const label = formatQty(line.qty, line.unit);
  return line.wastagePercent ? `${label} +${line.wastagePercent}% waste` : label;
}


/* ------------------------------------------------------------------ *
 * One question, four ways of answering it.
 *
 * "What did this cost me?" has a different answer in every trade: a bakery
 * works it out from flour and eggs, a thrift shop from a share of what the
 * bale cost, a phone shop from the price of that exact handset, and everyone
 * else from what they paid the supplier. The mode lives on the product, so a
 * shop that does two of these at once — and plenty do — gets the right answer
 * for each line rather than one average that is wrong for both.
 * ------------------------------------------------------------------ */

export function stockModeOf(product: Product): StockMode {
  if (product.stockMode) return product.stockMode;
  // Older records: a recipe means it is produced, anything else is plain stock.
  return product.recipe?.length ? "recipe" : "simple";
}

export interface UnitCost {
  mode: StockMode;
  /** Null when the mode cannot produce a cost yet — an unsorted lot, no units. */
  cost: number | null;
  /** Where the number came from, in words the seller can check. */
  basis: string;
  margin: number | null;
  marginPercent: number | null;
}

export function unitCost(product: Product, db: Database): UnitCost {
  const mode = stockModeOf(product);

  const settle = (cost: number | null, basis: string): UnitCost => ({
    mode,
    cost,
    basis,
    margin: cost === null ? null : product.price - cost,
    marginPercent:
      cost === null || product.price <= 0 ? null : ((product.price - cost) / product.price) * 100,
  });

  switch (mode) {
    case "recipe": {
      const costed = costProduct(product, db.ingredients);
      return settle(
        costed ? costed.unitCost : null,
        costed
          ? `${product.recipe?.length ?? 0} ingredients, costed to the gram`
          : "No recipe set yet",
      );
    }
    case "lot": {
      const cost = lotUnitCost(product, db);
      const lot = db.lots.find((l) => l.id === product.lotId);
      return settle(
        cost,
        lot
          ? `A share of ${lot.reference}, split ${lot.allocation === "by_value" ? "by what each grade sells for" : "evenly"}`
          : "Not linked to a lot yet",
      );
    }
    case "serial": {
      const summary = summariseSerials(unitsOf(db, product.id));
      return settle(
        summary.averageCost,
        summary.inStock.length
          ? `Average of the ${summary.inStock.length} ${summary.inStock.length === 1 ? "unit" : "units"} actually on the shelf`
          : "No units in stock to cost",
      );
    }
    case "service":
      return settle(0, "A service — nothing bought in");
    default:
      return settle(product.cost || null, product.cost ? "What you paid the supplier" : "No cost price set");
  }
}

/** The stock count to trust for a product, whatever mode it is tracked in. */
export function stockOf(product: Product, db: Database) {
  if (stockModeOf(product) === "serial") {
    return unitsOf(db, product.id).filter((unit) => unit.status === "in_stock").length;
  }
  return product.stock;
}

/** Which modes this business is actually using — the rest are never shown. */
export function activeStockModes(db: Database): StockMode[] {
  const modes = new Set(db.products.map(stockModeOf));
  if (db.ingredients.length) modes.add("recipe");
  if (db.lots.length) modes.add("lot");
  if (db.serials.length) modes.add("serial");
  // Services live in their own list, not among the products.
  if (db.services.some((service) => service.active)) modes.add("service");
  return (["recipe", "service", "lot", "serial", "simple"] as StockMode[]).filter((mode) =>
    modes.has(mode),
  );
}

/** Everything the business has money sitting in, however it is tracked. */
export function totalStockValue(db: Database) {
  const simple = db.products
    .filter((p) => {
      const mode = stockModeOf(p);
      return mode === "simple";
    })
    .reduce((sum, p) => sum + p.stock * p.cost, 0);
  return stockValue(db.ingredients) + lotStockValue(db) + serialStockValue(db) + simple;
}
