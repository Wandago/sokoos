"use client";

import { Nfc } from "lucide-react";
import { money } from "@/lib/format";

/**
 * The wallet card. Forest panel, lime glow, card chrome — the piece the
 * reference designs lead every finance dashboard with.
 */
export function BalanceCard({
  balance,
  businessName,
  tillNumber,
  caption,
}: {
  balance: number;
  businessName: string;
  tillNumber: string;
  caption: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-card bg-panel p-5 text-panel-text shadow-float ring-1 ring-white/5">
      {/* Lime bloom, bottom-right, clipped by the card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -right-10 size-56 rounded-full opacity-40 blur-2xl"
        style={{ background: "radial-gradient(circle, var(--lime-500), transparent 70%)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-6 -top-20 size-40 rounded-full opacity-15 blur-2xl"
        style={{ background: "radial-gradient(circle, var(--lime-300), transparent 70%)" }}
      />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[12px] font-semibold text-panel-muted">{caption}</p>
          <p className="tabular mt-1.5 text-[32px] font-extrabold leading-none tracking-[-0.03em]">
            {money(balance)}
          </p>
        </div>
        <Nfc className="size-6 rotate-90 text-panel-muted" />
      </div>

      <div className="relative mt-7 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold">{businessName}</p>
          <p className="tabular mt-0.5 text-[12px] text-panel-muted">
            Till •••• {tillNumber.slice(-4)}
          </p>
        </div>
        <span className="rounded-full bg-brand px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-brand-ink">
          M-Pesa
        </span>
      </div>
    </div>
  );
}
