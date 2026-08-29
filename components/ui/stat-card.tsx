"use client";

import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import { cn } from "@/lib/cn";

export type BadgeTint = 1 | 2 | 3 | 4;

const badgeTints: Record<BadgeTint, string> = {
  1: "bg-badge-1-bg text-badge-1-fg",
  2: "bg-badge-2-bg text-badge-2-fg",
  3: "bg-badge-3-bg text-badge-3-fg",
  4: "bg-badge-4-bg text-badge-4-fg",
};

/**
 * The metric card the reference dashboards are built from: a label with an
 * explainer, a tinted icon badge, the number, what it moved against, and a
 * signed delta pill.
 */
export function StatCard({
  label,
  hint,
  value,
  icon: Icon,
  tint = 1,
  change,
  changeLabel = "vs last month",
  delta,
  /** True when a rise is bad — spending, refunds, unpaid balances. */
  invert,
  className,
}: {
  label: string;
  hint?: string;
  value: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  tint?: BadgeTint;
  change?: string;
  changeLabel?: string;
  delta?: number;
  invert?: boolean;
  className?: string;
}) {
  const flat = delta !== undefined && Math.abs(delta) < 0.05;
  const up = (delta ?? 0) >= 0;
  const good = invert ? !up : up;

  return (
    <div
      className={cn(
        "rounded-card border border-border-subtle bg-surface p-3.5 shadow-card",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="flex min-w-0 items-center gap-1 pt-0.5 text-[12px] font-semibold text-text-secondary">
          <span className="truncate">{label}</span>
          {hint && (
            <span title={hint} className="shrink-0">
              <Info className="size-3 text-text-muted" aria-label={hint} />
            </span>
          )}
        </p>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-xl",
            badgeTints[tint],
          )}
        >
          <Icon className="size-[15px]" strokeWidth={2.2} />
        </span>
      </div>

      <p className="tabular mt-1.5 truncate text-[22px] font-extrabold tracking-[-0.03em]">
        {value}
      </p>

      {change && (
        <p className="tabular mt-0.5 truncate text-[11px] text-text-muted">
          {change} <span className="font-medium">{changeLabel}</span>
        </p>
      )}

      {delta !== undefined && (
        <span
          className={cn(
            "tabular mt-2.5 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold",
            flat
              ? "bg-surface-sunken text-text-secondary"
              : good
                ? "bg-success-soft text-success-text"
                : "bg-danger-soft text-danger-text",
          )}
        >
          {flat ? (
            "No change"
          ) : (
            <>
              {up ? "+" : "−"}
              {Math.abs(delta).toFixed(1)}%
              {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            </>
          )}
        </span>
      )}
    </div>
  );
}

/** The small signed pill used beside headline figures. */
export function DeltaPill({
  delta,
  invert,
  className,
}: {
  delta: number;
  invert?: boolean;
  className?: string;
}) {
  const flat = Math.abs(delta) < 0.05;
  const up = delta >= 0;
  const good = invert ? !up : up;
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold",
        flat
          ? "bg-surface-sunken text-text-secondary"
          : good
            ? "bg-success-soft text-success-text"
            : "bg-danger-soft text-danger-text",
        className,
      )}
    >
      {flat ? (
        "No change"
      ) : (
        <>
          {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
          {Math.abs(delta).toFixed(1)}%
        </>
      )}
    </span>
  );
}
