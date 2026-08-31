"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChefHat,
  CircleAlert,
  Layers,
  Minus,
  Package,
  PackageOpen,
  Plus,
  ScanBarcode,
  Scale,
  Timer,
  TrendingDown,
} from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/ui/page";
import { Hydrated } from "@/components/ui/hydrated";
import { EmptyState, ListSkeleton } from "@/components/ui/state";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Card, Divider } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { useQuery } from "@/lib/use-query";
import {
  activeStockModes,
  costProduct,
  costedProducts,
  formatLineQty,
  formatQty,
  lowIngredients,
  stockValue,
  totalStockValue,
} from "@/lib/costing";
import { costedLots } from "@/lib/lots";
import { costedServices } from "@/lib/services";
import { serialisedProducts } from "@/lib/serials";
import { money } from "@/lib/format";
import { cn } from "@/lib/cn";
import { AddThingSheet } from "@/components/catalogue/add-sheet";
import { LotSheet } from "@/components/stock/lot-sheet";
import { SerialSheet } from "@/components/stock/serial-sheet";
import type { Ingredient, StockMode, Unit } from "@/lib/types";

export default function StockPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Hydrated>
        <StockScreen />
      </Hydrated>
    </Suspense>
  );
}

/**
 * One screen, four ways of counting.
 *
 * A bakery, a thrift stall and a phone shop do not track stock the same way,
 * and pretending they do is how software ends up fitting none of them. Only
 * the modes this business actually uses appear as tabs; a seller who just
 * counts boxes never sees a recipe tab in their life.
 */
const modeMeta: Record<StockMode, { label: string; blurb: string }> = {
  recipe: { label: "Recipes", blurb: "Costed from what goes in" },
  lot: { label: "Lots", blurb: "Bought as a bale or carton" },
  serial: { label: "Serials", blurb: "Tracked unit by unit" },
  simple: { label: "Stock", blurb: "Counted and costed simply" },
  service: { label: "Services", blurb: "Sold by the hour, not off a shelf" },
};

function StockScreen() {
  const { db } = useStore();
  const { get, set } = useQuery();

  const modes = useMemo(() => activeStockModes(db), [db]);
  const [tab, setTab] = useState<StockMode | "ingredients">(modes[0] ?? "simple");

  const costed = useMemo(() => costedProducts(db), [db]);
  const lots = useMemo(() => costedLots(db), [db]);
  const serials = useMemo(() => serialisedProducts(db), [db]);
  const services = useMemo(() => costedServices(db), [db]);
  const low = lowIngredients(db.ingredients);

  const openProduct = db.products.find((p) => p.id === get("id"));
  const openIngredient = db.ingredients.find((i) => i.id === get("ing"));
  const openLot = db.lots.find((l) => l.id === get("lot"));
  const openSerialProduct = db.products.find((p) => p.id === get("serial"));

  const options = [
    ...modes.map((mode) => ({
      value: mode as StockMode | "ingredients",
      label: modeMeta[mode].label,
      count:
        mode === "recipe"
          ? costed.length
          : mode === "lot"
            ? lots.length
            : mode === "serial"
              ? serials.length
              : mode === "service"
                ? services.length
                : db.products.filter((p) => (p.stockMode ?? "simple") === mode).length,
    })),
    ...(db.ingredients.length
      ? [{ value: "ingredients" as const, label: "Store", count: db.ingredients.length }]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Stock"
        subtitle="What you have, what it cost, and how much is left — counted the way your trade actually counts it."
        action={
          <Button size="sm" onClick={() => set("new", "1")}>
            <Plus className="size-4" strokeWidth={2.5} />
            Add
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-2.5">
        <StatCard
          label="Stock on hand"
          hint="At what you paid for it"
          value={money(totalStockValue(db), { compact: true })}
          icon={Package}
          tint={1}
        />
        <StatCard
          label="Running low"
          hint="Below your reorder line"
          value={String(low.length)}
          icon={CircleAlert}
          tint={low.length ? 3 : 2}
        />
      </div>

      {options.length > 1 && (
        <Segmented className="mb-5" value={tab} onChange={setTab} options={options} />
      )}

      {tab === "recipe" && (
        <RecipeList costed={costed} onOpen={(id) => set("id", id)} />
      )}

      {tab === "lot" && (
        <div className="space-y-2.5">
          {lots.map((costedLot) => {
            const { lot } = costedLot;
            return (
              <button
                key={lot.id}
                onClick={() => set("lot", lot.id)}
                className="flex w-full items-center gap-3 rounded-card border border-border-subtle bg-surface p-3.5 text-left shadow-card transition-colors hover:bg-surface-hover"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-text">
                  <PackageOpen className="size-5" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[15px] font-semibold">{lot.reference}</p>
                    <p className="tabular shrink-0 text-[15px] font-bold">
                      {money(costedLot.landedCost)}
                    </p>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-text-secondary">
                    {lot.name} · {costedLot.units} pieces
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge tone={costedLot.paidBack ? "success" : "pending"}>
                      {costedLot.paidBack
                        ? "Paid back"
                        : `${costedLot.unitsToBreakEven} more to break even`}
                    </Badge>
                    <Badge tone="neutral">
                      {costedLot.grades.reduce((s, g) => s + g.remaining, 0)} left
                    </Badge>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {tab === "serial" && (
        <div className="space-y-2.5">
          {serials.map(({ product, summary }) => (
            <button
              key={product.id}
              onClick={() => set("serial", product.id)}
              className="flex w-full items-center gap-3 rounded-card border border-border-subtle bg-surface p-3.5 text-left shadow-card transition-colors hover:bg-surface-hover"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-text-secondary">
                <ScanBarcode className="size-5" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-[15px] font-semibold">{product.name}</p>
                  <p className="tabular shrink-0 text-[15px] font-bold">{money(product.price)}</p>
                </div>
                <p className="mt-0.5 text-[12px] text-text-secondary">
                  {summary.inStock.length} on the shelf · {summary.sold.length} sold ·{" "}
                  {money(summary.stockValue)} tied up
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone={summary.inStock.length ? "neutral" : "danger"}>
                    {summary.inStock.length ? `${summary.inStock.length} in stock` : "Out of stock"}
                  </Badge>
                  {summary.faulty.length > 0 && (
                    <Badge tone="danger">{summary.faulty.length} faulty</Badge>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {tab === "service" && (
        <>
          {/* Time, not stock, is what runs out. So the comparison that matters
              is what an hour of each job actually clears. */}
          <div className="mb-4 flex gap-3 rounded-2xl bg-surface-sunken p-3.5">
            <Timer className="size-5 shrink-0 text-text-secondary" />
            <p className="text-[12px] leading-relaxed text-text-secondary">
              Your own hours are not a cost — they are what you have to sell. So what each job
              leaves you, divided by the hours it eats, is the number to compare. The dearest job
              on the list is not always the best use of a morning.
            </p>
          </div>
          <div className="space-y-2.5">
            {services.map(({ service, cost }) => (
              <Link
                key={service.id}
                href={`/bookings/?new=1`}
                className="flex w-full items-center gap-3 rounded-card border border-border-subtle bg-surface p-3.5 text-left shadow-card transition-colors hover:bg-surface-hover"
              >
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl text-[20px]"
                  style={{ background: `${service.swatch}1f` }}
                >
                  {service.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[15px] font-semibold">{service.name}</p>
                    <p className="tabular shrink-0 text-[15px] font-bold">{money(service.price)}</p>
                  </div>
                  <p className="mt-0.5 text-[12px] text-text-secondary">
                    {cost.hours.toFixed(1)}h
                    {service.bufferMinutes ? ` incl. ${service.bufferMinutes}m turnaround` : ""}
                    {cost.materials > 0 ? ` · ${money(cost.materials)} materials` : " · nothing bought in"}
                    {cost.paidLabour > 0 ? ` · ${money(cost.paidLabour)} paid time` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge
                      tone={
                        cost.earns < 0
                          ? "danger"
                          : cost.earnsPercent >= 60
                            ? "success"
                            : "pending"
                      }
                    >
                      {cost.earns < 0
                        ? "Costs more than it earns"
                        : `Leaves ${money(cost.earns)}`}
                    </Badge>
                    <Badge tone={cost.earnsPerHour < 0 ? "danger" : "neutral"}>
                      {money(cost.earnsPerHour)}/hr
                    </Badge>
                    {service.depositPercent ? (
                      <Badge tone="neutral">{service.depositPercent}% deposit</Badge>
                    ) : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {tab === "simple" && (
        <div className="space-y-2.5">
          {db.products
            .filter((p) => (p.stockMode ?? (p.recipe?.length ? "recipe" : "simple")) === "simple")
            .map((product) => {
              const margin = product.price > 0 ? ((product.price - product.cost) / product.price) * 100 : 0;
              return (
                <div
                  key={product.id}
                  className="flex items-center gap-3 rounded-card border border-border-subtle bg-surface p-3.5"
                >
                  <span
                    className="flex size-11 shrink-0 items-center justify-center rounded-xl text-[20px]"
                    style={{ background: `${product.swatch}1f` }}
                  >
                    {product.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[15px] font-semibold">{product.name}</p>
                      <p className="tabular shrink-0 text-[15px] font-bold">{money(product.price)}</p>
                    </div>
                    <p className="mt-0.5 text-[12px] text-text-secondary">
                      Cost {money(product.cost)} · {margin.toFixed(0)}% margin
                    </p>
                    <div className="mt-2">
                      <Badge tone={product.stock <= product.lowStockAt ? "pending" : "neutral"}>
                        {product.stock} in stock
                      </Badge>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {tab === "ingredients" && (
        <>
          {low.length > 0 && (
            <>
              <SectionTitle>Order these</SectionTitle>
              <div className="mb-6 space-y-2.5">
                {low.map((ingredient) => (
                  <IngredientRow
                    key={ingredient.id}
                    ingredient={ingredient}
                    onOpen={() => set("ing", ingredient.id)}
                  />
                ))}
              </div>
            </>
          )}
          <SectionTitle>Everything in the store</SectionTitle>
          <div className="space-y-2.5">
            {db.ingredients.map((ingredient) => (
              <IngredientRow
                key={ingredient.id}
                ingredient={ingredient}
                onOpen={() => set("ing", ingredient.id)}
              />
            ))}
          </div>
          <p className="mt-4 px-1 text-[12px] leading-relaxed text-text-muted">
            Ingredients are worth {money(stockValue(db.ingredients))}. Stock comes off when an
            order is marked delivered, so this stays true without a separate count.
          </p>
        </>
      )}

      {openProduct && <RecipeSheet productId={openProduct.id} onClose={() => set("id", null)} />}
      {openIngredient && (
        <IngredientSheet ingredient={openIngredient} onClose={() => set("ing", null)} />
      )}
      <AddThingSheet open={get("new") === "1"} onClose={() => set("new", null)} />
      {openLot && <LotSheet lotId={openLot.id} onClose={() => set("lot", null)} />}
      {openSerialProduct && (
        <SerialSheet productId={openSerialProduct.id} onClose={() => set("serial", null)} />
      )}
    </>
  );
}

function RecipeList({
  costed,
  onOpen,
}: {
  costed: ReturnType<typeof costedProducts>;
  onOpen: (id: string) => void;
}) {
  if (!costed.length) {
    return (
      <EmptyState
        icon={<ChefHat className="size-6" />}
        title="No recipes yet"
        body="Give a product a recipe and its cost, margin and stock cover are worked out for you."
      />
    );
  }
  return (
    <div className="space-y-2.5">
      {costed.map(({ product, cost }) => (
        <button
          key={product.id}
          onClick={() => onOpen(product.id)}
          className="flex w-full items-center gap-3 rounded-card border border-border-subtle bg-surface p-3.5 text-left shadow-card transition-colors hover:bg-surface-hover"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-soft-text">
            <ChefHat className="size-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-[15px] font-semibold">{product.name}</p>
              <p className="tabular shrink-0 text-[15px] font-bold">{money(product.price)}</p>
            </div>
            <p className="mt-0.5 text-[12px] text-text-secondary">
              Costs {money(cost.unitCost)} · {product.recipe?.length} ingredients
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge
                tone={
                  cost.marginPercent >= 45
                    ? "success"
                    : cost.marginPercent >= 25
                      ? "pending"
                      : "danger"
                }
              >
                {cost.marginPercent.toFixed(0)}% margin
              </Badge>
              <Badge tone={cost.makeable > 0 ? "neutral" : "danger"}>
                {cost.makeable > 0 ? `${cost.makeable} makeable` : "Cannot make"}
              </Badge>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function IngredientRow({ ingredient, onOpen }: { ingredient: Ingredient; onOpen: () => void }) {
  const low = ingredient.stock <= ingredient.lowStockAt;
  // How full the bin is, capped so a big restock does not overflow the bar.
  const fill = Math.min(100, (ingredient.stock / Math.max(ingredient.lowStockAt * 3, 1)) * 100);

  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-card border border-border-subtle bg-surface p-3.5 text-left transition-colors hover:bg-surface-hover"
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          low ? "bg-pending-soft text-pending-text" : "bg-surface-sunken text-text-secondary",
        )}
      >
        <Scale className="size-[18px]" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[14px] font-semibold">{ingredient.name}</p>
          <p className="tabular shrink-0 text-[14px] font-bold">
            {formatQty(ingredient.stock, ingredient.unit)}
          </p>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
          <div
            className={cn("h-full rounded-full", low ? "bg-pending" : "bg-brand")}
            style={{ width: `${Math.max(fill, 3)}%` }}
          />
        </div>
        <p className="mt-1.5 text-[12px] text-text-secondary">
          {money(ingredient.costPerUnit)} per {ingredient.unit} ·{" "}
          {money(ingredient.stock * ingredient.costPerUnit)} on hand
          {ingredient.supplier ? ` · ${ingredient.supplier}` : ""}
        </p>
      </div>
    </button>
  );
}

function RecipeSheet({ productId, onClose }: { productId: string; onClose: () => void }) {
  const { db } = useStore();
  const product = db.products.find((p) => p.id === productId);
  const cost = product ? costProduct(product, db.ingredients) : null;
  if (!product || !cost) return null;

  const [worst] = [...cost.lines].sort((a, b) => b.cost - a.cost);

  return (
    <Sheet open onClose={onClose} title={product.name} description="Cost per unit, to the gram" size="lg">
      <div className="space-y-4 pb-4">
        <Card>
          <div className="grid grid-cols-3 divide-x divide-border-subtle">
            <Figure label="Sells for" value={money(product.price)} />
            <Figure label="Costs" value={money(cost.unitCost)} />
            <Figure
              label="Margin"
              value={`${cost.marginPercent.toFixed(0)}%`}
              tone={cost.marginPercent >= 45 ? "success" : cost.marginPercent >= 25 ? "pending" : "danger"}
            />
          </div>
        </Card>

        <div className="flex gap-3 rounded-2xl bg-surface-sunken p-3.5">
          <Layers className="size-5 shrink-0 text-text-secondary" />
          <p className="text-[13px] leading-relaxed text-text-secondary">
            {cost.makeable > 0 ? (
              <>
                You can make <strong className="font-semibold text-text">{cost.makeable}</strong>{" "}
                right now.{" "}
                {cost.limitedBy && (
                  <>
                    <strong className="font-semibold text-text">{cost.limitedBy.name}</strong> runs
                    out first.
                  </>
                )}
              </>
            ) : (
              <>
                You cannot make this right now
                {cost.limitedBy ? ` — ${cost.limitedBy.name} has run out.` : "."}
              </>
            )}
          </p>
        </div>

        {worst && (
          <div className="flex gap-3 rounded-2xl bg-ai-soft p-3.5">
            <TrendingDown className="size-5 shrink-0 text-ai" />
            <p className="text-[13px] leading-relaxed text-ai-text">
              The biggest cost is {worst.ingredient?.name?.toLowerCase()} at {money(worst.cost)} —{" "}
              {((worst.cost / cost.unitCost) * 100).toFixed(0)}% of what this costs to make. A 10%
              better price there is {money(worst.cost * 0.1)} more margin on every one you sell.
            </p>
          </div>
        )}

        <Card>
          <div className="p-4">
            <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.06em] text-text-secondary">
              What goes in
            </p>
            <div className="space-y-3">
              {cost.lines.map((line, i) => (
                <div key={i}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[14px] font-medium">
                      {line.ingredient?.name ?? "Missing ingredient"}
                    </span>
                    <span className="tabular shrink-0 text-[14px] font-semibold">
                      {money(line.cost)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-3 text-[12px] text-text-secondary">
                    <span>{formatLineQty(line.line)}</span>
                    <span className="tabular">
                      {Number.isFinite(line.makeable) ? `covers ${line.makeable}` : "—"}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{
                        width: `${Math.max((line.cost / Math.max(cost.unitCost, 1)) * 100, 2)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <Divider className="my-3.5" />
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[14px] font-semibold">Cost per unit</span>
              <span className="tabular text-[17px] font-extrabold">{money(cost.unitCost)}</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-text-secondary">Profit per unit</span>
              <span
                className={cn(
                  "tabular text-[14px] font-bold",
                  cost.margin >= 0 ? "text-success-text" : "text-danger",
                )}
              >
                {money(cost.margin)}
              </span>
            </div>
          </div>
        </Card>

        <p className="px-1 text-[12px] leading-relaxed text-text-muted">
          Stock comes off the store when an order is marked delivered, so this stays true without a
          separate count.
        </p>
      </div>
    </Sheet>
  );
}

export function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "pending" | "danger";
}) {
  return (
    <div className="px-3 py-3.5 text-center">
      <p
        className={cn(
          "tabular text-[17px] font-extrabold",
          tone === "success" && "text-success-text",
          tone === "pending" && "text-pending-text",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-text-secondary">{label}</p>
    </div>
  );
}

const units: Unit[] = ["kg", "g", "l", "ml", "piece"];

function IngredientSheet({ ingredient, onClose }: { ingredient: Ingredient; onClose: () => void }) {
  const { adjustIngredientStock, saveIngredient } = useStore();
  const toast = useToast();
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState(String(ingredient.costPerUnit));
  const [lowAt, setLowAt] = useState(String(ingredient.lowStockAt));
  const [unit, setUnit] = useState<Unit>(ingredient.unit);

  const delta = Number(amount) || 0;

  return (
    <Sheet
      open
      onClose={onClose}
      title={ingredient.name}
      description={`${formatQty(ingredient.stock, ingredient.unit)} on hand`}
      size="lg"
      footer={
        <Button
          full
          size="lg"
          onClick={() => {
            saveIngredient({
              ...ingredient,
              unit,
              costPerUnit: Number(price) || ingredient.costPerUnit,
              lowStockAt: Number(lowAt) || 0,
            });
            onClose();
            toast("Saved. Every recipe using it has repriced.");
          }}
        >
          Save
        </Button>
      }
    >
      <div className="space-y-4 pb-4">
        <div className="rounded-2xl border border-border-subtle bg-surface p-4">
          <p className="mb-2.5 text-[13px] font-semibold">Count it in or out</p>
          <div className="flex items-center gap-2">
            <Input
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              className="flex-1"
            />
            <span className="text-[13px] font-semibold text-text-secondary">{ingredient.unit}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <Button
              variant="secondary"
              disabled={!delta}
              onClick={() => {
                adjustIngredientStock(ingredient.id, -delta);
                setAmount("");
                toast(`Wrote off ${formatQty(delta, ingredient.unit)}.`);
              }}
            >
              <Minus className="size-4" />
              Write off
            </Button>
            <Button
              disabled={!delta}
              onClick={() => {
                adjustIngredientStock(ingredient.id, delta);
                setAmount("");
                toast(`Added ${formatQty(delta, ingredient.unit)}.`);
              }}
            >
              <Plus className="size-4" />
              Restock
            </Button>
          </div>
        </div>

        <Field label="Cost per unit" hint="Change this and every recipe using it reprices itself.">
          <Input
            prefix="KES"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))}
          />
        </Field>

        <Field label="Base unit">
          <Select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
            {units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Tell me when it drops below">
          <Input
            inputMode="decimal"
            value={lowAt}
            onChange={(e) => setLowAt(e.target.value.replace(/[^\d.]/g, ""))}
          />
        </Field>
      </div>
    </Sheet>
  );
}
