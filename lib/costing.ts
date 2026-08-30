import type { Database, Ingredient, Product, RecipeLine, Unit } from "./types";
import { unitFactor } from "./types";

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
