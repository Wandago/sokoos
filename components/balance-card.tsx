"use client";

import { useState } from "react";
import { ArrowUpRight, Copy, Eye, EyeOff, Nfc } from "lucide-react";
import { money } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * The wallet card. Forest panel, lime bloom, card chrome — the piece every
 * reference dashboard leads with. The balance hides on tap, because people
 * open this on a matatu.
 */
export function BalanceCard({
  balance,
  businessName,
  tillNumber,
  caption,
  delta,
  className,
}: {
  balance: number;
  businessName: string;
  tillNumber: string;
  caption: string;
  delta?: number;
  className?: string;
}) {
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-card bg-panel p-5 text-panel-text shadow-float ring-1 ring-white/5",
        className,
      )}
    >
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

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[12px] font-semibold text-panel-muted">{caption}</p>
            <button
              onClick={() => setHidden((h) => !h)}
              aria-label={hidden ? "Show balance" : "Hide balance"}
              className="text-panel-muted transition-colors hover:text-white"
            >
              {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>
          <p className="tabular mt-1.5 text-[32px] font-extrabold leading-none tracking-[-0.03em]">
            {hidden ? "KES ••••••" : money(balance)}
          </p>
          {delta !== undefined && (
            <span className="tabular mt-2.5 inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-brand-ink">
              <ArrowUpRight className={cn("size-3", delta < 0 && "rotate-90")} />
              {delta >= 0 ? "+" : "−"}
              {Math.abs(delta).toFixed(1)}% this month
            </span>
          )}
        </div>
        <Nfc className="size-6 shrink-0 rotate-90 text-panel-muted" />
      </div>

      <div className="relative mt-6 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold">{businessName}</p>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(tillNumber).then(
                () => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1600);
                },
                () => undefined,
              );
            }}
            className="tabular mt-0.5 flex items-center gap-1.5 text-[12px] text-panel-muted transition-colors hover:text-white"
          >
            Till •••• {tillNumber.slice(-4)}
            <Copy className="size-3" />
            {copied && <span className="text-[10px] font-semibold text-brand">Copied</span>}
          </button>
        </div>
        <span className="rounded-full bg-brand px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-brand-ink">
          M-Pesa
        </span>
      </div>
    </div>
  );
}
