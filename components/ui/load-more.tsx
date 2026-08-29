"use client";

import { cn } from "@/lib/cn";

/**
 * Long lists (a month of orders, payments or ledger entries) render in pages —
 * a phone should never have to lay out a thousand rows to show the first ten.
 */
export function LoadMore({
  total,
  visible,
  step = 30,
  onMore,
  className,
}: {
  total: number;
  visible: number;
  step?: number;
  onMore: () => void;
  className?: string;
}) {
  if (visible >= total) {
    return total > 0 ? (
      <p className={cn("py-6 text-center text-[12px] text-text-muted", className)}>
        That&apos;s everything — {total} {total === 1 ? "record" : "records"}.
      </p>
    ) : null;
  }

  const remaining = total - visible;
  return (
    <button
      onClick={onMore}
      className={cn(
        "mt-3 h-11 w-full rounded-xl border border-border bg-surface text-[13px] font-semibold text-text-secondary transition-colors hover:bg-surface-hover",
        className,
      )}
    >
      Show {Math.min(step, remaining)} more · {remaining} left
    </button>
  );
}
