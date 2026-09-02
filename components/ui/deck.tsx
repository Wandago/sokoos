"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * A deck of cards you scroll sideways.
 *
 * The card at the right edge is deliberately cut off. That half-visible card is
 * the only affordance on a phone that reliably says "there is more here" —
 * better than a row of dots, and far better than arrows, which on a touch
 * screen are decoration. The arrows exist anyway, for a mouse and for a
 * keyboard, and are hidden from assistive tech because they duplicate the
 * scrolling the container already does natively.
 *
 * Scroll position is the state. There is no active index driving the layout,
 * because the moment there is one, a flick that lands between two cards has to
 * be reconciled with it — and the browser's own snapping already does that job
 * correctly on every platform.
 */
export function Deck({
  label,
  children,
  className,
  /** Shown above the deck, with the arrows on the right. */
  title,
  action,
  trackClassName,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  action?: React.ReactNode;
  /** For a deck that has to fill a column rather than size to its cards. */
  trackClassName?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState({ start: true, end: false });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setAt({
      start: el.scrollLeft < 8,
      // A pixel of slack: sub-pixel widths mean scrollLeft rarely lands exactly.
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8,
    });
  }, []);

  useEffect(() => {
    measure();
    const el = track.current;
    if (!el) return;
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  const nudge = (direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    // One card, whatever a card happens to be at this width.
    const step = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? el.clientWidth * 0.8;
    el.scrollBy({ left: direction * (step + 12), behavior: "smooth" });
  };

  return (
    <section className={className} aria-roledescription="carousel" aria-label={label}>
      {(title || action) && (
        <div className="mb-3 flex items-end justify-between gap-3 px-4 lg:px-0">
          {title}
          <div className="flex shrink-0 items-center gap-1.5">
            {action}
            <div className="hidden gap-1.5 sm:flex" aria-hidden>
              <Arrow onClick={() => nudge(-1)} disabled={at.start} label="Previous">
                <ChevronLeft className="size-4" strokeWidth={2.6} />
              </Arrow>
              <Arrow onClick={() => nudge(1)} disabled={at.end} label="Next">
                <ChevronRight className="size-4" strokeWidth={2.6} />
              </Arrow>
            </div>
          </div>
        </div>
      )}

      {/* The negative margin lets cards run to the screen edge while the page
          around them keeps its gutter — so the cut-off card really is cut off
          by the screen, not by a container that stops short of it. */}
      <div
        ref={track}
        className={cn("deck no-scrollbar -mx-4 px-4 pb-1 lg:-mx-1 lg:px-1", trackClassName)}
        tabIndex={0}
        role="group"
      >
        {children}
      </div>
    </section>
  );
}

function Arrow({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      tabIndex={-1}
      aria-label={label}
      className={cn(
        "grid size-8 place-items-center rounded-full border border-border bg-surface text-text transition-opacity",
        disabled ? "opacity-30" : "hover:bg-surface-hover",
      )}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ *
 * The card
 * ------------------------------------------------------------------ */

export type DeckTone = "forest" | "lime" | "cream" | "surface";

const tones: Record<DeckTone, { card: string; muted: string; chip: string; cta: string; panel: string }> = {
  forest: {
    card: "bg-forest-900 text-white",
    muted: "text-forest-200",
    chip: "bg-white/12 text-white",
    cta: "bg-brand text-brand-ink",
    panel: "bg-forest-950/45",
  },
  lime: {
    card: "bg-brand text-brand-ink",
    muted: "text-brand-ink/70",
    chip: "bg-brand-ink/10 text-brand-ink",
    cta: "bg-forest-900 text-white",
    panel: "bg-white/35",
  },
  cream: {
    card: "bg-[#EFF3E2] text-forest-950",
    muted: "text-forest-700",
    chip: "bg-forest-900/8 text-forest-900",
    cta: "bg-forest-900 text-white",
    panel: "bg-white/60",
  },
  surface: {
    card: "bg-surface text-text border border-border-subtle",
    muted: "text-text-secondary",
    chip: "bg-surface-sunken text-text-secondary",
    cta: "bg-forest-900 text-white",
    panel: "bg-surface-sunken",
  },
};

/** The illustration's own palette follows the card it sits on. */
export const surfaceForTone: Record<DeckTone, "forest" | "lime" | "cream" | "paper"> = {
  forest: "forest",
  lime: "lime",
  cream: "cream",
  surface: "paper",
};

export function DeckCard({
  tone = "surface",
  tags,
  title,
  body,
  illustration,
  cta,
  onClick,
  className,
  width = "w-[16.5rem]",
}: {
  tone?: DeckTone;
  tags?: string[];
  title: React.ReactNode;
  body?: string;
  illustration?: React.ReactNode;
  cta?: string;
  onClick?: () => void;
  className?: string;
  width?: string;
}) {
  const t = tones[tone];
  const interactive = Boolean(onClick);
  const Tag = interactive ? "button" : "div";

  return (
    <Tag
      {...(interactive ? { type: "button" as const, onClick } : {})}
      className={cn(
        "card-press flex flex-col overflow-hidden rounded-3xl text-left",
        width,
        t.card,
        className,
      )}
    >
      <div className="px-4 pt-4">
        {tags && tags.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {tags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-bold tracking-tight",
                  t.chip,
                )}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <h3 className="text-[26px] font-extrabold leading-[1.05] tracking-[-0.035em]">{title}</h3>
        {body && <p className={cn("mt-2 text-[13px] leading-relaxed", t.muted)}>{body}</p>}
      </div>

      {illustration && (
        <div className="px-3 pb-3 pt-4">
          <div
            className={cn(
              "relative grid aspect-[4/3] place-items-center overflow-hidden rounded-2xl",
              t.panel,
            )}
          >
            {illustration}

            {cta && (
              <span className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-[12px] font-bold shadow-card",
                    t.cta,
                  )}
                >
                  {cta}
                </span>
                <span
                  className={cn("grid size-8 shrink-0 place-items-center rounded-full", t.cta)}
                  aria-hidden
                >
                  <ArrowRight className="size-4" strokeWidth={2.6} />
                </span>
              </span>
            )}
          </div>
        </div>
      )}
    </Tag>
  );
}
