"use client";

import { Suspense, useMemo, useState } from "react";
import {
  Banknote,
  Check,
  Minus,
  Plus,
  Receipt as ReceiptIcon,
  Smartphone,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { Hydrated } from "@/components/ui/hydrated";
import { ListSkeleton, EmptyState } from "@/components/ui/state";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, SearchInput } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/chart";
import { useToast } from "@/components/ui/toast";
import { ReceiptSheet } from "@/components/receipt-sheet";
import { useStore } from "@/lib/store";
import {
  availableSerials,
  blockers,
  canSell,
  cartTotals,
  cashOutcome,
  sellableCount,
  serialIdsIn,
  tenderSuggestions,
  tillToday,
  toOrderItems,
  type CartLine,
} from "@/lib/pos";
import { money } from "@/lib/format";
import { looksLikeMpesaCode } from "@/lib/receipts";
import type { Payment, PaymentMethod, Product } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * The till.
 *
 * Built for one hand and a queue. The product grid is the whole screen, the
 * cart is a bar at the bottom that grows as it fills, and paying is two taps
 * from anywhere. Nothing here opens a form that has to be completed before the
 * sale can continue — a customer waiting at a counter is the hardest deadline
 * in the product, and every field that could be filled in later is.
 *
 * A counter sale posts exactly the records an Instagram order posts. There is
 * no separate till ledger to reconcile at closing, because a second set of
 * books is how a shop loses track of the first.
 */
export default function PosPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Hydrated>
        <PosScreen />
      </Hydrated>
    </Suspense>
  );
}

function PosScreen() {
  const { db, sellAtCounter } = useStore();
  const toast = useToast();

  const [lines, setLines] = useState<CartLine[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [paying, setPaying] = useState(false);
  const [picking, setPicking] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Payment | null>(null);

  const day = tillToday(db);
  const totals = cartTotals(lines);
  const problems = blockers(db, lines);

  const sellable = useMemo(
    () => db.products.filter((p) => p.active),
    [db.products],
  );

  const categories = useMemo(
    () => ["All", ...new Set(sellable.map((p) => p.category).filter(Boolean))],
    [sellable],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sellable.filter(
      (p) =>
        (category === "All" || p.category === category) &&
        (!q || p.name.toLowerCase().includes(q)),
    );
  }, [sellable, query, category]);

  const qtyOf = (productId: string) =>
    lines.find((l) => l.productId === productId)?.qty ?? 0;

  function add(product: Product) {
    const verdict = canSell(db, product, qtyOf(product.id));
    if (!verdict.ok) {
      toast(verdict.message, "info");
      return;
    }
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) => (l.productId === product.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [
        ...prev,
        { productId: product.id, name: product.name, price: product.price, qty: 1 },
      ];
    });
    // A serialised product cannot be sold without naming the unit, so ask now
    // rather than at the payment step where it becomes an obstacle.
    if (product.stockMode === "serial") setPicking(product.id);
  }

  function change(productId: string, delta: number) {
    setLines((prev) =>
      prev
        .map((l) =>
          l.productId === productId
            ? {
                ...l,
                qty: l.qty + delta,
                // Reducing the count drops the last handset picked, so the two
                // never drift out of step.
                serialIds: l.serialIds?.slice(0, Math.max(0, l.qty + delta)),
              }
            : l,
        )
        .filter((l) => l.qty > 0),
    );
  }

  function complete(method: PaymentMethod, amount: number, reference?: string) {
    const { payment } = sellAtCounter({
      items: toOrderItems(lines),
      discount: 0,
      payment: amount > 0 ? { method, amount, reference } : undefined,
      serialIds: serialIdsIn(lines),
    });
    setLines([]);
    setPaying(false);
    if (payment) {
      setReceipt(payment);
    } else {
      toast("Handed over. The balance is on the books.", "info");
    }
  }

  return (
    <>
      <PageHeader
        title="Till"
        subtitle="Selling across the counter. Everything lands in the same book."
      />

      <div className="mb-5 grid grid-cols-3 gap-2.5">
        <StatTile label="Sales today" value={String(day.sales)} />
        <StatTile label="Cash" value={money(day.cash, { compact: true })} />
        <StatTile
          label="M-Pesa"
          value={money(day.mpesa, { compact: true })}
          tone={day.owed > 0 ? "default" : "default"}
        />
      </div>

      {day.owed > 0 && (
        <div className="mb-5 flex items-start gap-2.5 rounded-2xl bg-pending-soft p-3.5 text-pending-text">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <p className="text-[13px] leading-relaxed">
            <span className="font-semibold">{money(day.owed)}</span> of goods left the counter
            today without being paid for. It is on the books as owed.
          </p>
        </div>
      )}

      <SearchInput
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search what you sell"
      />

      {categories.length > 2 && (
        <div className="deck no-scrollbar -mx-4 mt-3 px-4">
          {categories.map((name) => (
            <button
              key={name}
              onClick={() => setCategory(name)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                category === name
                  ? "bg-forest-900 text-white"
                  : "bg-surface text-text-secondary hover:bg-surface-hover",
              )}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {shown.length ? (
        <div className="mt-4 grid grid-cols-2 gap-2.5 pb-64 sm:grid-cols-3 lg:grid-cols-4 lg:pb-40">
          {shown.map((product) => (
            <Tile
              key={product.id}
              product={product}
              inCart={qtyOf(product.id)}
              available={sellableCount(db, product)}
              onAdd={() => add(product)}
            />
          ))}
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState
            icon={<ReceiptIcon className="size-6" />}
            title="Nothing to sell yet"
            body="Add what you sell under Products, and it appears here ready to ring up."
          />
        </div>
      )}

      {/* ---- The cart, always within a thumb's reach --------------------- */}
      {lines.length > 0 && (
        /* Sits above the bottom navigation, not under it. At z-30 behind a
           z-40 nav the Charge button was covered on a phone — the one control
           this whole screen exists to reach. */
        <div className="fixed inset-x-2 bottom-[4.5rem] z-40 rounded-3xl border border-border-subtle bg-surface px-4 pb-4 pt-3 shadow-[0_-8px_30px_-12px_rgb(0_0_0/.28)] lg:inset-x-auto lg:bottom-0 lg:left-64 lg:right-0 lg:rounded-none lg:border-x-0 lg:border-b-0">
          <div className="mx-auto max-w-5xl">
            <div className="no-scrollbar max-h-40 overflow-y-auto">
              {lines.map((line) => {
                const product = db.products.find((p) => p.id === line.productId);
                const needsSerial =
                  product?.stockMode === "serial" && (line.serialIds?.length ?? 0) < line.qty;
                return (
                  <div key={line.productId} className="flex items-center gap-2 py-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold">{line.name}</p>
                      <p className="tabular text-[12px] text-text-secondary">
                        {money(line.price)} each
                        {needsSerial && (
                          <button
                            onClick={() => setPicking(line.productId)}
                            className="ml-2 font-semibold text-danger underline"
                          >
                            pick which one
                          </button>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Step onClick={() => change(line.productId, -1)} label={`One less ${line.name}`}>
                        {line.qty === 1 ? <Trash2 className="size-3.5" /> : <Minus className="size-3.5" />}
                      </Step>
                      <span className="tabular w-6 text-center text-[14px] font-bold">{line.qty}</span>
                      <Step onClick={() => product && add(product)} label={`One more ${line.name}`}>
                        <Plus className="size-3.5" />
                      </Step>
                    </div>
                    <span className="tabular w-20 shrink-0 text-right text-[14px] font-bold">
                      {money(line.price * line.qty)}
                    </span>
                  </div>
                );
              })}
            </div>

            {problems.length > 0 && (
              <p className="mt-2 text-[12px] font-medium text-danger">{problems[0]}</p>
            )}

            <div className="mt-2.5 flex items-center gap-3">
              <button
                onClick={() => setLines([])}
                className="shrink-0 rounded-full px-3 py-2 text-[13px] font-semibold text-text-secondary hover:bg-surface-hover"
              >
                Clear
              </button>
              <Button
                full
                size="lg"
                disabled={problems.length > 0}
                onClick={() => setPaying(true)}
              >
                Charge {money(totals.total)}
                <span className="tabular ml-1 text-[13px] opacity-70">
                  · {totals.count} {totals.count === 1 ? "item" : "items"}
                </span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {paying && (
        <PaySheet
          total={totals.total}
          onClose={() => setPaying(false)}
          onDone={complete}
        />
      )}

      {picking && (
        <SerialSheet
          productId={picking}
          lines={lines}
          onClose={() => setPicking(null)}
          onChoose={(productId, serialIds) =>
            setLines((prev) =>
              prev.map((l) => (l.productId === productId ? { ...l, serialIds } : l)),
            )
          }
        />
      )}

      {receipt && <ReceiptSheet payment={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}

/* ------------------------------------------------------------------ *
 * The grid
 * ------------------------------------------------------------------ */

function Tile({
  product,
  inCart,
  available,
  onAdd,
}: {
  product: Product;
  inCart: number;
  available: number;
  onAdd: () => void;
}) {
  const out = available <= 0 && product.stockMode !== "service";
  const low = !out && available <= (product.lowStockAt ?? 0);

  return (
    <button
      onClick={onAdd}
      disabled={out}
      className={cn(
        "card-press relative flex min-h-[6.5rem] flex-col justify-between rounded-2xl border p-3 text-left",
        inCart > 0
          ? "border-brand bg-brand-soft"
          : "border-border-subtle bg-surface hover:bg-surface-hover",
        out && "opacity-45",
      )}
    >
      {inCart > 0 && (
        <span className="tabular absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-forest-900 text-[12px] font-bold text-white">
          {inCart}
        </span>
      )}

      <p className="pr-7 text-[14px] font-semibold leading-tight">{product.name}</p>

      <div>
        <p className="tabular text-[16px] font-extrabold tracking-tight">{money(product.price)}</p>
        {out ? (
          <Badge tone="danger">Out of stock</Badge>
        ) : product.stockMode === "service" ? (
          <span className="text-[11px] text-text-secondary">Service</span>
        ) : (
          <span className={cn("text-[11px]", low ? "font-semibold text-pending-text" : "text-text-secondary")}>
            {available} left
          </span>
        )}
      </div>
    </button>
  );
}

function Step({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="grid size-7 place-items-center rounded-full bg-surface-sunken text-text transition-colors hover:bg-surface-hover"
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Taking the money
 * ------------------------------------------------------------------ */

function PaySheet({
  total,
  onClose,
  onDone,
}: {
  total: number;
  onClose: () => void;
  onDone: (method: PaymentMethod, amount: number, reference?: string) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [tendered, setTendered] = useState(String(total));
  const [reference, setReference] = useState("");

  const given = Number(tendered) || 0;
  const cash = cashOutcome(total, given);
  const suggestions = tenderSuggestions(total);

  /* An M-Pesa code is the one thing that makes a receipt checkable later, so
   * the till says whether what has been typed is actually one — before the
   * customer leaves, while it can still be corrected. */
  const codeLooksReal = looksLikeMpesaCode(reference);

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Take ${money(total)}`}
      description="The money goes where it always goes. This only writes it down."
      size="lg"
      footer={
        <div className="space-y-2">
          <Button
            full
            size="lg"
            onClick={() =>
              onDone(method, method === "cash" ? Math.min(given, total) : given, reference)
            }
            disabled={given <= 0}
          >
            <Check className="size-4" strokeWidth={2.8} />
            {cash.enough ? "Done" : `Take ${money(given)} now`}
          </Button>
          {/* Handing goods over unpaid is a real thing in a shop. Refusing to
              model it just means the sale gets typed in wrongly. */}
          <Button variant="ghost" full onClick={() => onDone(method, 0)}>
            Hand over without paying
          </Button>
        </div>
      }
    >
      <div className="space-y-5 pb-4">
        <div className="grid grid-cols-2 gap-2.5">
          <MethodButton
            active={method === "cash"}
            onClick={() => {
              setMethod("cash");
              setTendered(String(total));
            }}
            icon={<Banknote className="size-5" />}
            label="Cash"
          />
          <MethodButton
            active={method === "mpesa"}
            onClick={() => {
              setMethod("mpesa");
              setTendered(String(total));
            }}
            icon={<Smartphone className="size-5" />}
            label="M-Pesa"
          />
        </div>

        {method === "cash" ? (
          <>
            <Field label="Cash given">
              <Input
                prefix="KES"
                inputMode="numeric"
                value={tendered}
                onChange={(e) => setTendered(e.target.value.replace(/\D/g, ""))}
              />
            </Field>

            <div className="flex flex-wrap gap-2">
              {suggestions.map((note) => (
                <button
                  key={note}
                  onClick={() => setTendered(String(note))}
                  className={cn(
                    "tabular rounded-full px-3.5 py-2 text-[13px] font-bold transition-colors",
                    given === note
                      ? "bg-forest-900 text-white"
                      : "bg-surface-sunken text-text hover:bg-surface-hover",
                  )}
                >
                  {money(note)}
                </button>
              ))}
            </div>

            {/* The number the shopkeeper is about to count out of the drawer.
                Set large because it is read at arm's length, in a hurry. */}
            {cash.change > 0 && (
              <div className="rounded-2xl bg-brand p-4 text-brand-ink">
                <p className="text-[12px] font-bold uppercase tracking-[0.12em]">Change to give</p>
                <p className="tabular mt-1 text-[34px] font-extrabold leading-none tracking-[-0.03em]">
                  {money(cash.change)}
                </p>
              </div>
            )}

            {cash.short > 0 && given > 0 && (
              <div className="rounded-2xl bg-pending-soft p-4 text-pending-text">
                <p className="text-[12px] font-bold uppercase tracking-[0.12em]">Still owed</p>
                <p className="tabular mt-1 text-[26px] font-extrabold leading-none tracking-[-0.03em]">
                  {money(cash.short)}
                </p>
                <p className="mt-1.5 text-[12px] leading-relaxed">
                  This stays on the books as owed until it is paid.
                </p>
              </div>
            )}
          </>
        ) : (
          <>
            <Field label="Amount received">
              <Input
                prefix="KES"
                inputMode="numeric"
                value={tendered}
                onChange={(e) => setTendered(e.target.value.replace(/\D/g, ""))}
              />
            </Field>

            <Field
              label="M-Pesa code"
              hint={
                reference && !codeLooksReal
                  ? "That is not a Safaricom confirmation code — the receipt will say so rather than pretend."
                  : "From the message on the customer's phone. It is what makes their receipt checkable."
              }
            >
              <Input
                value={reference}
                autoCapitalize="characters"
                spellCheck={false}
                onChange={(e) => setReference(e.target.value.toUpperCase())}
              />
            </Field>

            {codeLooksReal && (
              <p className="flex items-center gap-1.5 text-[13px] font-semibold text-success-text">
                <Check className="size-4" strokeWidth={2.8} />
                That will make the receipt checkable.
              </p>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

function MethodButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 rounded-2xl border py-4 text-[15px] font-bold transition-colors",
        active
          ? "border-transparent bg-forest-900 text-white"
          : "border-border bg-surface text-text hover:bg-surface-hover",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * Which exact unit is leaving
 * ------------------------------------------------------------------ */

function SerialSheet({
  productId,
  lines,
  onClose,
  onChoose,
}: {
  productId: string;
  lines: CartLine[];
  onClose: () => void;
  onChoose: (productId: string, serialIds: string[]) => void;
}) {
  const { db } = useStore();
  const product = db.products.find((p) => p.id === productId);
  const line = lines.find((l) => l.productId === productId);
  const units = availableSerials(db, productId);
  const [chosen, setChosen] = useState<string[]>(line?.serialIds ?? []);

  const need = line?.qty ?? 1;

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Which ${product?.name ?? "unit"}?`}
      description={`Pick ${need === 1 ? "the one" : `the ${need}`} leaving the shop. The warranty follows this number.`}
      size="lg"
      footer={
        <Button
          full
          disabled={chosen.length !== need}
          onClick={() => {
            onChoose(productId, chosen);
            onClose();
          }}
        >
          {chosen.length === need ? "Done" : `${chosen.length} of ${need} picked`}
        </Button>
      }
    >
      <div className="space-y-2 pb-4">
        {units.map((unit) => {
          const on = chosen.includes(unit.id);
          return (
            <button
              key={unit.id}
              onClick={() =>
                setChosen((prev) =>
                  on
                    ? prev.filter((id) => id !== unit.id)
                    : prev.length < need
                      ? [...prev, unit.id]
                      : // Replace the oldest pick rather than silently ignoring
                        // the tap, which reads as the screen being broken.
                        [...prev.slice(1), unit.id],
                )
              }
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition-colors",
                on ? "border-brand bg-brand-soft" : "border-border-subtle bg-surface",
              )}
            >
              <span
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full border-2",
                  on ? "border-transparent bg-forest-900 text-white" : "border-border",
                )}
              >
                {on && <Check className="size-3.5" strokeWidth={3} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="tabular block truncate text-[14px] font-semibold">
                  {unit.serial}
                </span>
                <span className="block text-[12px] text-text-secondary">
                  Cost {money(unit.cost)}
                  {unit.warrantyMonths ? ` · ${unit.warrantyMonths} month warranty` : ""}
                </span>
              </span>
            </button>
          );
        })}

        {!units.length && (
          <p className="py-6 text-center text-[13px] text-text-secondary">
            No units of this in stock. Receive some under Stock first.
          </p>
        )}
      </div>
    </Sheet>
  );
}
