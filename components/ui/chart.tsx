"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";

/* Every chart here is a single series, so none carries a legend — the card
 * title names the measure. Values are direct-labelled selectively, never on
 * every mark, and each chart answers a tap with a value. */

export interface Point {
  label: string;
  value: number;
  secondary?: number;
  key?: string;
}

/* ------------------------------------------------------------------ *
 * Daily bars — magnitude across a short, ordered set of days.
 * ------------------------------------------------------------------ */
export function BarChart({
  data,
  height = 132,
  valueFormat = (v: number) => money(v, { compact: true }),
  emphasisIndex,
  hideHeadline,
  className,
}: {
  data: Point[];
  height?: number;
  valueFormat?: (v: number) => string;
  /** Index rendered solid; the rest sit back. Defaults to the last bar. */
  emphasisIndex?: number;
  /** Suppress the built-in headline when the card already states the number. */
  hideHeadline?: boolean;
  className?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);
  const emphasis = emphasisIndex ?? data.length - 1;
  const shown = active ?? emphasis;
  const shownPoint = data[shown];

  return (
    <div className={cn("select-none", className)}>
      {!hideHeadline && (
        <div className="mb-3 flex items-baseline gap-2">
          <span className="tabular text-2xl font-bold tracking-tight">
            {valueFormat(shownPoint?.value ?? 0)}
          </span>
          <span className="text-[13px] text-text-secondary">{shownPoint?.label}</span>
        </div>
      )}
      <div
        className="flex items-end gap-[3px]"
        style={{ height }}
        onMouseLeave={() => setActive(null)}
      >
        {data.map((point, i) => {
          const isActive = i === shown;
          const barHeight = Math.max(3, (point.value / max) * height);
          return (
            <button
              key={point.key ?? point.label + i}
              type="button"
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
              aria-label={`${point.label}: ${valueFormat(point.value)}`}
              className="group relative flex flex-1 items-end justify-center"
              style={{ height }}
            >
              <span
                className={cn(
                  "w-full rounded-lg transition-[background-color,filter] duration-150",
                  isActive
                    ? "bg-chart-series"
                    : "bg-chart-accent group-hover:brightness-95",
                )}
                style={{ height: barHeight }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-[3px]">
        {data.map((point, i) => (
          <span
            key={(point.key ?? point.label) + "-l" + i}
            className={cn(
              "flex-1 text-center text-[10px] font-medium",
              i === shown ? "text-text" : "text-text-muted",
            )}
          >
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Trend — change over time. Line + soft fill, 2px stroke at any width.
 * ------------------------------------------------------------------ */
export function TrendChart({
  data,
  height = 150,
  valueFormat = (v: number) => money(v, { compact: true }),
  className,
}: {
  data: Point[];
  height?: number;
  valueFormat?: (v: number) => string;
  className?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const W = 300;
  const H = 100;
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = 0;

  const { line, area, coords } = useMemo(() => {
    const step = data.length > 1 ? W / (data.length - 1) : W;
    const points = data.map((d, i) => {
      const x = i * step;
      const y = H - ((d.value - min) / (max - min || 1)) * (H - 8) - 4;
      return { x, y };
    });
    const path = points
      .map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
      .join(" ");
    return {
      line: path,
      area: `${path} L${W},${H} L0,${H} Z`,
      coords: points,
    };
  }, [data, max]);

  const shown = active ?? data.length - 1;
  const point = data[shown];

  return (
    <div className={cn("select-none", className)}>
      <div className="mb-3 flex items-baseline gap-2">
        <span className="tabular text-2xl font-bold tracking-tight">
          {valueFormat(point?.value ?? 0)}
        </span>
        <span className="text-[13px] text-text-secondary">{point?.label}</span>
      </div>
      <div className="relative" style={{ height }} onMouseLeave={() => setActive(null)}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible"
          role="img"
          aria-label={`Trend: ${data.map((d) => `${d.label} ${valueFormat(d.value)}`).join(", ")}`}
        >
          <defs>
            <linearGradient id="soko-trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--lime-500)" stopOpacity="0.85" />
              <stop offset="60%" stopColor="var(--lime-500)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="var(--lime-500)" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#soko-trend-fill)" />
          <path
            d={line}
            fill="none"
            stroke="var(--chart-series)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {coords[shown] && (
            <>
              <line
                x1={coords[shown].x}
                y1="0"
                x2={coords[shown].x}
                y2={H}
                stroke="var(--chart-grid)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={coords[shown].x}
                cy={coords[shown].y}
                r="4"
                fill="var(--chart-series)"
                stroke="var(--surface)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>
        {/* Hit targets sit above the drawing, wider than the marks. */}
        <div className="absolute inset-0 flex">
          {data.map((d, i) => (
            <button
              key={(d.key ?? d.label) + i}
              type="button"
              aria-label={`${d.label}: ${valueFormat(d.value)}`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
              className="h-full flex-1"
            />
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-medium text-text-muted">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Ranked bars — magnitude by category, sorted, directly labelled.
 * Preferred over a pie/donut: the ranking is the point.
 * ------------------------------------------------------------------ */
export function RankedBars({
  data,
  valueFormat = (v: number) => money(v, { compact: true }),
  className,
}: {
  data: (Point & { note?: string })[];
  valueFormat?: (v: number) => string;
  className?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className={cn("space-y-3", className)}>
      {data.map((d, i) => (
        <div key={(d.key ?? d.label) + i}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="truncate text-[13px] font-medium">{d.label}</span>
            <span className="tabular shrink-0 text-[13px] font-semibold">
              {valueFormat(d.value)}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full bg-chart-accent transition-[width] duration-500"
              style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }}
            />
          </div>
          {d.note && <p className="mt-1 text-[11px] text-text-muted">{d.note}</p>}
        </div>
      ))}
    </div>
  );
}

/** Headline number for a KPI tile. Not a chart — no plot, no tooltip. */
export function StatTile({
  label,
  value,
  unit,
  sub,
  tone = "default",
  className,
}: {
  label: string;
  value: string;
  /** Currency or measure, shown beside the label so the number stays whole. */
  unit?: string;
  sub?: React.ReactNode;
  tone?: "default" | "brand" | "danger" | "delivery";
  className?: string;
}) {
  const tones = {
    default: "text-text",
    brand: "text-brand-text",
    danger: "text-danger",
    delivery: "text-delivery",
  };
  return (
    <div
      className={cn(
        "rounded-card border border-border-subtle bg-surface p-4 shadow-card",
        className,
      )}
    >
      <p className="flex items-baseline gap-1 text-[12px] font-semibold text-text-secondary">
        <span className="truncate">{label}</span>
        {unit && <span className="text-[10px] font-bold text-text-muted">{unit}</span>}
      </p>
      <p
        className={cn(
          "tabular mt-1.5 truncate text-[17px] font-bold tracking-[-0.02em] sm:text-xl",
          tones[tone],
        )}
      >
        {value}
      </p>
      {sub && <div className="mt-1 text-[11px] text-text-muted">{sub}</div>}
    </div>
  );
}
