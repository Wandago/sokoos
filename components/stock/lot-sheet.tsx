"use client";

import { PackageOpen, Scale, TrendingUp } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Card, Divider } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { costLot } from "@/lib/lots";
import { fullDate, money } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * A bale, opened up.
 *
 * The question a trader actually asks is "has this bale paid for itself yet,
 * and what is left worth?" — so that is what leads. Underneath it, the cost
 * allocation is shown as arithmetic rather than a single cost-per-piece
 * number, because splitting a joint cost is a choice and the seller should see
 * which choice was made.
 */
export function LotSheet({ lotId, onClose }: { lotId: string; onClose: () => void }) {
  const { db } = useStore();
  const lot = db.lots.find((l) => l.id === lotId);
  if (!lot) return null;

  const costed = costLot(lot);
  const remaining = costed.grades.reduce((sum, g) => sum + g.remaining, 0);
  const recoveredPercent = Math.min(100, (costed.recovered / Math.max(costed.landedCost, 1)) * 100);

  return (
    <Sheet open onClose={onClose} title={lot.reference} description={lot.name} size="lg">
      <div className="space-y-4 pb-4">
        <Card>
          <div className="grid grid-cols-3 divide-x divide-border-subtle">
            <Figure label="It cost you" value={money(costed.landedCost)} />
            <Figure label="Back so far" value={money(costed.recovered)} />
            <Figure
              label="Still to sell"
              value={money(costed.remainingValue)}
              tone={remaining > 0 ? undefined : "success"}
            />
          </div>
        </Card>

        {/* Has it paid for itself? The only question that matters on day one. */}
        <div
          className={cn(
            "rounded-2xl p-4",
            costed.paidBack ? "bg-success-soft" : "bg-pending-soft",
          )}
        >
          <div className="flex items-center gap-2.5">
            <TrendingUp
              className={cn(
                "size-5 shrink-0",
                costed.paidBack ? "text-success-text" : "text-pending-text",
              )}
            />
            <p
              className={cn(
                "text-[14px] font-bold",
                costed.paidBack ? "text-success-text" : "text-pending-text",
              )}
            >
              {costed.paidBack
                ? "This bale has paid for itself"
                : `${costed.unitsToBreakEven} more pieces to break even`}
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10">
            <div
              className={cn(
                "h-full rounded-full",
                costed.paidBack ? "bg-success" : "bg-pending",
              )}
              style={{ width: `${Math.max(recoveredPercent, 3)}%` }}
            />
          </div>
          <p
            className={cn(
              "mt-2 text-[12px] leading-relaxed",
              costed.paidBack ? "text-success-text" : "text-pending-text",
            )}
          >
            {costed.paidBack ? (
              <>
                {money(costed.recovered)} taken in against a {money(costed.landedCost)} cost —{" "}
                {money(costed.recovered - costed.landedCost)} clear so far.
              </>
            ) : (
              <>{money(costed.recovered)} of {money(costed.landedCost)} back so far.</>
            )}{" "}
            {remaining} of {costed.units} pieces still on the shelf, worth{" "}
            {money(costed.remainingValue)} at today&apos;s prices — which would make this bale{" "}
            {money(costed.projectedProfit)} in the end.
          </p>
        </div>

        {/* What it really cost to get here. */}
        <Card>
          <div className="p-4">
            <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.06em] text-text-secondary">
              What it cost to get here
            </p>
            <Row label={`Paid to ${lot.supplier}`} value={money(lot.purchasePrice)} />
            {lot.extraCosts.map((cost) => (
              <Row key={cost.label} label={cost.label} value={money(cost.amount)} muted />
            ))}
            <Divider className="my-2.5" />
            <Row label="Landed cost" value={money(costed.landedCost)} strong />
            <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
              Bought {fullDate(lot.purchasedAt)}
              {lot.openedAt ? `, opened and sorted ${fullDate(lot.openedAt)}` : " — not opened yet"}.
            </p>
          </div>
        </Card>

        {/* The allocation, stated as a choice rather than a fact. */}
        <Card>
          <div className="p-4">
            <div className="mb-1 flex items-center justify-between gap-3">
              <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-text-secondary">
                What came out
              </p>
              <Badge tone="neutral">
                {lot.allocation === "by_value" ? "Split by value" : "Split evenly"}
              </Badge>
            </div>
            <p className="mb-3.5 text-[12px] leading-relaxed text-text-muted">
              {lot.allocation === "by_value"
                ? "The landed cost is shared out in proportion to what each grade sells for. Dividing it evenly would say a Grade C top cost the same as a Grade A dress, which would make your best stock look like your worst."
                : "Every piece is the same, so the landed cost is divided evenly across them."}
            </p>

            <div className="space-y-4">
              {costed.grades.map((line) => (
                <div key={line.grade.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[14px] font-semibold">{line.grade.label}</span>
                    <span className="tabular shrink-0 text-[14px] font-bold">
                      {money(line.costPerUnit)}
                      <span className="text-[11px] font-medium text-text-muted"> each</span>
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-text-secondary">
                    {line.grade.units} pieces at {money(line.grade.unitPrice)} ·{" "}
                    {line.grade.sold} sold, {line.remaining} left
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{
                          width: `${Math.max(
                            (line.grade.sold / Math.max(line.grade.units, 1)) * 100,
                            2,
                          )}%`,
                        }}
                      />
                    </div>
                    <Badge
                      tone={
                        line.marginPercent >= 45
                          ? "success"
                          : line.marginPercent >= 25
                            ? "pending"
                            : "danger"
                      }
                    >
                      {line.marginPercent.toFixed(0)}%
                    </Badge>
                  </div>
                  <p className="mt-1.5 text-[11px] text-text-muted">
                    Carries {money(line.allocatedCost)} of the {money(costed.landedCost)} landed
                    cost.
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {lot.note && (
          <div className="flex gap-3 rounded-2xl bg-surface-sunken p-3.5">
            <PackageOpen className="size-5 shrink-0 text-text-secondary" />
            <p className="text-[13px] leading-relaxed text-text-secondary">{lot.note}</p>
          </div>
        )}

        <div className="flex gap-3 rounded-2xl bg-surface-sunken p-3.5">
          <Scale className="size-5 shrink-0 text-text-secondary" />
          <p className="text-[12px] leading-relaxed text-text-muted">
            Change a grade&apos;s price and every piece in it recosts, because the split follows the
            money each grade can bring in.
          </p>
        </div>
      </div>
    </Sheet>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "pending" | "danger";
}) {
  return (
    <div className="px-2 py-3.5 text-center">
      <p
        className={cn(
          "tabular text-[16px] font-extrabold",
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

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-0.5">
      <span className={cn("text-[13px]", muted ? "text-text-secondary" : "text-text")}>
        {label}
      </span>
      <span className={cn("tabular text-[13px] font-semibold", strong && "text-[15px] font-extrabold")}>
        {value}
      </span>
    </div>
  );
}
