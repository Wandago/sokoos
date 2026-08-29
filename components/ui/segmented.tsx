"use client";

import { cn } from "@/lib/cn";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** Horizontal filter row. Scrolls on a phone rather than wrapping or shrinking. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={cn(
              "flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[13px] font-semibold transition-colors",
              active
                ? "border-transparent bg-brand text-brand-ink"
                : "border-border bg-surface text-text-secondary hover:bg-surface-hover",
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  "tabular rounded-full px-1.5 text-[11px]",
                  active ? "bg-brand-ink/12" : "bg-surface-sunken text-text-muted",
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
