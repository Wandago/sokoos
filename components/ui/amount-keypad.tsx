"use client";

import { Delete } from "lucide-react";
import { cn } from "@/lib/cn";
import { num } from "@/lib/format";

const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "back"];

/**
 * Entering money on a phone should not mean a text field and a soft keyboard.
 * Big keys, quick amounts, and the figure itself as the headline.
 */
export function AmountKeypad({
  value,
  onChange,
  quickAmounts = [500, 1000, 2500, 5000],
  caption = "Enter amount",
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  quickAmounts?: number[];
  caption?: string;
  className?: string;
}) {
  const press = (key: string) => {
    if (key === "back") {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === ".") {
      if (value.includes(".")) return;
      onChange((value || "0") + ".");
      return;
    }
    // Two decimal places, and no leading zeros to trip up parsing.
    if (value.includes(".") && value.split(".")[1].length >= 2) return;
    if (value === "0") {
      onChange(key);
      return;
    }
    if (value.replace(".", "").length >= 9) return;
    onChange(value + key);
  };

  const display = value
    ? value.includes(".")
      ? `${num(Number(value.split(".")[0] || 0))}.${value.split(".")[1]}`
      : num(Number(value))
    : "0";

  return (
    <div className={cn("select-none", className)}>
      <div className="text-center">
        <p className="tabular text-[38px] font-extrabold leading-none tracking-[-0.04em]">
          <span className="text-[20px] font-bold text-text-secondary">KES </span>
          {display}
        </p>
        <p className="mt-1.5 text-[12px] text-text-muted">{caption}</p>
      </div>

      <div className="no-scrollbar -mx-1 mt-4 flex gap-2 overflow-x-auto px-1">
        {quickAmounts.map((amount) => (
          <button
            key={amount}
            type="button"
            onClick={() => onChange(String(amount))}
            className="h-9 shrink-0 rounded-full border border-border bg-surface px-3.5 text-[13px] font-semibold text-text-secondary transition-colors hover:bg-surface-hover"
          >
            {num(amount)}
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2.5">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            aria-label={key === "back" ? "Delete" : key}
            className="flex h-14 items-center justify-center rounded-2xl bg-surface text-[22px] font-semibold shadow-card transition-colors hover:bg-surface-hover active:scale-[0.98]"
          >
            {key === "back" ? <Delete className="size-5 text-text-secondary" /> : key}
          </button>
        ))}
      </div>
    </div>
  );
}
