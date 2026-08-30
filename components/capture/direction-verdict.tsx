"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { money } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { DirectionVerdict } from "@/lib/direction";

/**
 * The verdict, with its reasoning on the face of it. A confident answer and a
 * shrug should not look the same, so a low-confidence call says so.
 */
export function DirectionVerdictCard({
  verdict,
  amount,
}: {
  verdict: DirectionVerdict;
  amount: number;
}) {
  const credit = verdict.direction === "credit";
  const unsure = verdict.confidence < 0.6;

  return (
    <div
      className={cn(
        "rounded-2xl p-4",
        unsure ? "bg-pending-soft" : credit ? "bg-success-soft" : "bg-surface-sunken",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            credit ? "bg-success text-white" : "bg-text text-text-inverted",
          )}
        >
          {credit ? (
            <ArrowDownLeft className="size-5" strokeWidth={2.4} />
          ) : (
            <ArrowUpRight className="size-5" strokeWidth={2.4} />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-[15px] font-bold",
              unsure ? "text-pending-text" : credit ? "text-success-text" : "text-text",
            )}
          >
            {credit ? "Money in" : "Money out"}
            <span className="ml-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] opacity-70">
              {credit ? "credit" : "debit"}
            </span>
          </p>
          {amount > 0 && (
            <p className="tabular text-[13px] font-semibold opacity-80">
              {credit ? "+" : "−"}
              {money(amount)}
            </p>
          )}
        </div>
      </div>

      <p
        className={cn(
          "mt-2.5 text-[12px] leading-relaxed",
          unsure ? "text-pending-text" : credit ? "text-success-text" : "text-text-secondary",
        )}
      >
        {verdict.reason}
        {unsure && " Change the wording above if that is wrong."}
      </p>
    </div>
  );
}
