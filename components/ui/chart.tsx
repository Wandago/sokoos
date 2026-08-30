"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { money, num } from "@/lib/format";

/* Charts are hand-rolled so they can wear the product's own chrome: lime
 * companions against a near-black emphasis mark, a forest pill tooltip, and
 * axis ticks that carry the values no label rides. */

export interface Point {
  label: string;
  value: number;
  key?: string;
}

/** Round a step up to 1, 2, 2.5 or 5 times a power of ten. */
function niceStep(rough: number) {
  if (rough <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (magnitude * step >= rough) return magnitude * step;
  }
  return magnitude * 10;
}

/**
 * Ticks are built from a clean step, not by slicing the maximum — dividing a
 * ceiling of 20 into thirds gives 0 / 6.7 / 13.3 / 20, which nobody can read.
 */
function axisScale(max: number, maxTicks = 4, integer = false) {
  const rough = Math.max(max, 1) / maxTicks;
  const step = integer ? Math.max(1, Math.round(niceStep(rough))) : niceStep(rough);
  const ceiling = Math.ceil(Math.max(max, 1) / step) * step;
  const ticks: number[] = [];
  for (let value = ceiling; value >= 0; value -= step) ticks.push(Number(value.toFixed(4)));
  return { ceiling, ticks };
}

/**
 * Catmull-Rom through the points, converted to cubic beziers. Control points
 * are clamped to the neighbouring values so the curve never overshoots into
 * territory the data never reached.
 */
function smoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) {
    return points.length ? `M${points[0].x},${points[0].y}` : "";
  }
  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const lo = Math.min(p1.y, p2.y);
    const hi = Math.max(p1.y, p2.y);
    const c1y = Math.min(hi, Math.max(lo, p1.y + (p2.y - p0.y) / 6));
    const c2y = Math.min(hi, Math.max(lo, p2.y - (p3.y - p1.y) / 6));

    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/** The dark readout pill. Value leads, label follows. */
function TooltipPill({
  value,
  label,
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "pointer-events-none inline-flex items-baseline gap-1.5 whitespace-nowrap rounded-full bg-text px-2.5 py-1 shadow-float",
        className,
      )}
    >
      <span className="tabular text-[11px] font-bold text-text-inverted">{value}</span>
      {label && <span className="text-[10px] font-medium text-text-inverted/70">{label}</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Columns — magnitude across a short, ordered set of days.
 * ------------------------------------------------------------------ */
export function BarChart({
  data,
  height = 132,
  valueFormat = (v: number) => money(v, { compact: true }),
  tickFormat = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : num(v)),
  emphasisIndex,
  hideHeadline,
  showAxis = true,
  /** Counts, not money: keeps the axis on whole numbers. */
  integerTicks,
  className,
}: {
  data: Point[];
  height?: number;
  valueFormat?: (v: number) => string;
  tickFormat?: (v: number) => string;
  /** Index rendered in the emphasis colour. Defaults to the last column. */
  emphasisIndex?: number;
  hideHeadline?: boolean;
  showAxis?: boolean;
  integerTicks?: boolean;
  className?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const rawMax = Math.max(...data.map((d) => d.value), 1);
  const { ceiling, ticks } = axisScale(rawMax, 4, integerTicks);
  const emphasis = emphasisIndex ?? data.length - 1;
  const shown = active ?? emphasis;
  const shownPoint = data[shown];

  return (
    <div className={cn("select-none", className)}>
      {!hideHeadline && (
        <div className="mb-3 flex items-baseline gap-2">
          <span className="tabular text-2xl font-bold tracking-[-0.03em]">
            {valueFormat(shownPoint?.value ?? 0)}
          </span>
          <span className="text-[13px] text-text-secondary">{shownPoint?.label}</span>
        </div>
      )}

      <div className="flex gap-2">
        {showAxis && (
          <div
            className="flex w-8 shrink-0 flex-col justify-between pb-0.5 text-right"
            style={{ height: height + 28 }}
            aria-hidden
          >
            {ticks.map((tick) => (
              <span key={tick} className="tabular text-[9px] font-medium text-text-muted">
                {tickFormat(tick)}
              </span>
            ))}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height }} onMouseLeave={() => setActive(null)}>
            {/* Hairline gridlines carry the values no column is labelled with. */}
            {showAxis && (
              <div className="absolute inset-0 flex flex-col justify-between" aria-hidden>
                {ticks.map((tick) => (
                  <span key={tick} className="h-px w-full bg-chart-grid" />
                ))}
              </div>
            )}

            <div className="absolute inset-0 flex items-end gap-0.5">
              {data.map((point, i) => {
                const isActive = i === shown;
                const barHeight = Math.max(4, (point.value / ceiling) * height);
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
                        // 4px rounded cap, square at the baseline, capped width
                        // so the slot always keeps some air.
                        "w-full max-w-6 rounded-t-[5px] transition-[background-color,filter] duration-150",
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

            {/* Readout rides above the selected column. */}
            {shownPoint && (
              <div
                className="absolute -translate-x-1/2 -translate-y-full pb-1.5"
                style={{
                  left: `${((shown + 0.5) / data.length) * 100}%`,
                  top: `${Math.max(0, height - (shownPoint.value / ceiling) * height)}px`,
                }}
              >
                <TooltipPill value={valueFormat(shownPoint.value)} />
              </div>
            )}
          </div>

          <div className="mt-2 flex gap-0.5">
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
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Grouped columns — two series side by side, per period.
 * ------------------------------------------------------------------ */
export function GroupedBarChart({
  data,
  seriesA,
  seriesB,
  height = 150,
  valueFormat = (v: number) => money(v, { compact: true }),
  tickFormat = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : num(v)),
  className,
}: {
  data: { label: string; a: number; b: number }[];
  seriesA: string;
  seriesB: string;
  height?: number;
  valueFormat?: (v: number) => string;
  tickFormat?: (v: number) => string;
  className?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const rawMax = Math.max(...data.flatMap((d) => [d.a, d.b]), 1);
  const { ceiling, ticks } = axisScale(rawMax);
  const shown = active ?? data.length - 1;
  const shownPoint = data[shown];

  return (
    <div className={cn("select-none", className)}>
      {/* Two series, so a legend is not optional. */}
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary">
          <span className="size-2.5 rounded-[3px] bg-chart-a" />
          {seriesA}
        </span>
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary">
          <span className="size-2.5 rounded-[3px] bg-chart-b" />
          {seriesB}
        </span>
      </div>

      <div className="flex gap-2">
        <div
          className="flex w-8 shrink-0 flex-col justify-between pb-0.5 text-right"
          style={{ height: height + 28 }}
          aria-hidden
        >
          {ticks.map((tick) => (
            <span key={tick} className="tabular text-[9px] font-medium text-text-muted">
              {tickFormat(tick)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height }} onMouseLeave={() => setActive(null)}>
            <div className="absolute inset-0 flex flex-col justify-between" aria-hidden>
              {ticks.map((tick) => (
                <span key={tick} className="h-px w-full bg-chart-grid" />
              ))}
            </div>

            <div className="absolute inset-0 flex items-end gap-1.5">
              {data.map((point, i) => (
                <button
                  key={point.label + i}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onClick={() => setActive(i)}
                  aria-label={`${point.label}: ${seriesA} ${valueFormat(point.a)}, ${seriesB} ${valueFormat(point.b)}`}
                  className={cn(
                    "flex flex-1 items-end justify-center gap-0.5 rounded-t transition-opacity",
                    active !== null && active !== i && "opacity-55",
                  )}
                  style={{ height }}
                >
                  <span
                    className="w-full max-w-2.5 rounded-t-[4px] bg-chart-a"
                    style={{ height: Math.max(3, (point.a / ceiling) * height) }}
                  />
                  <span
                    className="w-full max-w-2.5 rounded-t-[4px] bg-chart-b"
                    style={{ height: Math.max(3, (point.b / ceiling) * height) }}
                  />
                </button>
              ))}
            </div>

            {shownPoint && (
              <div
                className="absolute -translate-x-1/2 -translate-y-full pb-1.5"
                style={{
                  left: `${((shown + 0.5) / data.length) * 100}%`,
                  top: `${Math.max(0, height - (Math.max(shownPoint.a, shownPoint.b) / ceiling) * height)}px`,
                }}
              >
                <TooltipPill
                  value={`${valueFormat(shownPoint.a)} in`}
                  label={`${valueFormat(shownPoint.b)} out`}
                />
              </div>
            )}
          </div>

          <div className="mt-2 flex gap-1.5">
            {data.map((point, i) => (
              <span
                key={point.label + "-l" + i}
                className={cn(
                  "flex-1 whitespace-nowrap text-center text-[9px] font-medium",
                  i === shown ? "text-text" : "text-text-muted",
                )}
              >
                {point.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Trend — change over time. Hatched band, dotted line, pill readout.
 * ------------------------------------------------------------------ */
export function TrendChart({
  data,
  height = 160,
  valueFormat = (v: number) => money(v, { compact: true }),
  tickFormat = (v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : num(v)),
  className,
}: {
  data: Point[];
  height?: number;
  valueFormat?: (v: number) => string;
  tickFormat?: (v: number) => string;
  className?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const rawMax = Math.max(...data.map((d) => d.value), 1);
  const { ceiling, ticks } = axisScale(rawMax);

  // Percentage geometry, shared by the SVG paths and the HTML dots, so the
  // two layers never drift apart.
  const points = useMemo(
    () =>
      data.map((d, i) => ({
        x: data.length > 1 ? (i / (data.length - 1)) * 100 : 50,
        y: 100 - (d.value / ceiling) * 92 - 4,
      })),
    [data, ceiling],
  );

  const line = smoothPath(points);
  const area = `${line} L100,100 L0,100 Z`;

  const shown = active ?? data.length - 1;
  const point = data[shown];
  const coord = points[shown];

  return (
    <div className={cn("select-none", className)}>
      <div className="flex gap-2">
        <div
          className="flex w-8 shrink-0 flex-col justify-between pb-0.5 text-right"
          style={{ height: height + 24 }}
          aria-hidden
        >
          {ticks.map((tick) => (
            <span key={tick} className="tabular text-[9px] font-medium text-text-muted">
              {tickFormat(tick)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height }} onMouseLeave={() => setActive(null)}>
            <div className="absolute inset-0 flex flex-col justify-between" aria-hidden>
              {ticks.map((tick) => (
                <span key={tick} className="h-px w-full bg-chart-grid" />
              ))}
            </div>

            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="absolute inset-0 h-full w-full"
              role="img"
              aria-label={`Trend: ${data.map((d) => `${d.label} ${valueFormat(d.value)}`).join(", ")}`}
            >
              <defs>
                {/* A hatch reads lighter than a solid block at the same hue, so
                    the band never competes with the line. */}
                <pattern
                  id="soko-hatch"
                  width="6"
                  height="6"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <rect width="6" height="6" fill="var(--lime-500)" fillOpacity="0.14" />
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="6"
                    stroke="var(--lime-500)"
                    strokeWidth="2.2"
                    strokeOpacity="0.55"
                  />
                </pattern>
              </defs>
              <path d={area} fill="url(#soko-hatch)" />
              <path
                d={line}
                fill="none"
                stroke="var(--chart-series)"
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/* Dots and the readout live in HTML: perfectly round at any width,
                and the text never inherits the SVG's non-uniform scale. */}
            {points.map((p, i) => (
              <span
                key={i}
                aria-hidden
                className={cn(
                  "absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface",
                  i === shown ? "bg-chart-series" : "bg-chart-accent",
                )}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
              />
            ))}

            {coord && (
              <>
                <span
                  aria-hidden
                  className="absolute w-px -translate-x-1/2 bg-chart-series/40"
                  style={{ left: `${coord.x}%`, top: `${coord.y}%`, bottom: 0 }}
                />
                <div
                  className="absolute -translate-x-1/2 -translate-y-full pb-2"
                  style={{
                    left: `${Math.min(88, Math.max(12, coord.x))}%`,
                    top: `${coord.y}%`,
                  }}
                >
                  <TooltipPill value={valueFormat(point.value)} label={point.label} />
                </div>
              </>
            )}

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
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Ranked bars — magnitude by category, sorted, directly labelled.
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
    <div className={cn("space-y-3.5", className)}>
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
              className={cn(
                "h-full rounded-full transition-[width] duration-500",
                i === 0 ? "bg-chart-series" : "bg-chart-accent",
              )}
              style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }}
            />
          </div>
          {d.note && <p className="mt-1 text-[11px] text-text-muted">{d.note}</p>}
        </div>
      ))}
    </div>
  );
}

/** A goal meter: filled portion in the accent, track a lighter step. */
export function GoalMeter({
  current,
  target,
  className,
}: {
  current: number;
  target: number;
  className?: string;
}) {
  const percent = Math.min(100, (current / Math.max(target, 1)) * 100);
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[11px] font-semibold">
        <span className="shrink-0 opacity-70">Goal</span>
        <span className="tabular shrink-0">
          {money(current, { compact: true, bare: true })} /{" "}
          {money(target, { compact: true, bare: true })}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-brand-ink/15">
        <div
          className="h-full rounded-full bg-brand-ink transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
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
