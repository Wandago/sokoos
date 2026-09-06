"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/cn";

export interface TourStep {
  /** Matches an element's `data-tour="<selector>"` somewhere in the shell. */
  selector: string;
  title: string;
  body: string;
}

interface TourContextValue {
  start: (steps: TourStep[]) => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used inside <TourProvider>");
  return ctx;
}

/**
 * A handful of screens carry the same nav twice — a bottom bar on a phone,
 * a sidebar on desktop — and only one copy is ever visible. Picking the
 * first element with real size on screen, rather than the first match in
 * the DOM, is what lets one set of steps describe both layouts.
 */
function targetRect(selector: string): DOMRect | null {
  const nodes = document.querySelectorAll<HTMLElement>(`[data-tour="${selector}"]`);
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return rect;
  }
  return null;
}

/**
 * A guided walkthrough of the shell itself, for the moment a tour of feature
 * cards can't cover: an app with this many screens needs someone to point at
 * the four or five buttons that matter and say what they're for, in the
 * seller's own account, not a demo.
 *
 * Deliberately not a hole punched in an overlay — that needs a mask that
 * matches the target's exact shape, which breaks the moment a pill and a
 * circle appear in the same tour. A glowing outline over a dimmed screen
 * says "look here" just as clearly and never has to know what shape it's
 * drawing around.
 */
export function TourProvider({ children }: { children: React.ReactNode }) {
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  const start = useCallback((newSteps: TourStep[]) => {
    setSteps(newSteps);
    setIndex(0);
  }, []);

  const close = useCallback(() => {
    setSteps(null);
    setRect(null);
  }, []);

  const step = steps?.[index] ?? null;

  useEffect(() => {
    if (!step) return;
    const measure = () => setRect(targetRect(step.selector));
    // A frame's grace: right after a route change the nav can still be
    // laying itself out when this effect first runs.
    const raf = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
    };
  }, [step]);

  const value = useMemo(() => ({ start }), [start]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {step && (
        <TourOverlay
          step={step}
          rect={rect}
          index={index}
          total={steps!.length}
          onNext={() => (index + 1 < steps!.length ? setIndex((i) => i + 1) : close())}
          onSkip={close}
        />
      )}
    </TourContext.Provider>
  );
}

function TourOverlay({
  step,
  rect,
  index,
  total,
  onNext,
  onSkip,
}: {
  step: TourStep;
  rect: DOMRect | null;
  index: number;
  total: number;
  onNext: () => void;
  onSkip: () => void;
}) {
  // The callout sits above the target by default — every current target
  // lives in the bottom half of the screen — and falls below it if that
  // would run off the top edge.
  const below = rect ? rect.top < 220 : false;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={step.title}>
      <button
        type="button"
        onClick={onSkip}
        aria-label="Skip tour"
        className="absolute inset-0 bg-forest-950/60 backdrop-blur-[1px]"
      />

      {rect && (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-2xl ring-[3px] ring-brand"
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
            borderRadius: Math.min(rect.height + 16, 999) / 2,
          }}
        />
      )}

      <div
        className="absolute inset-x-4 max-w-sm rounded-[1.5rem] bg-bg-elevated p-5 shadow-overlay"
        style={
          rect
            ? below
              ? { top: rect.bottom + 20 }
              : { bottom: window.innerHeight - rect.top + 20 }
            : { bottom: 96 }
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-1.5" aria-hidden>
            {Array.from({ length: total }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 rounded-full bg-brand transition-all",
                  i === index ? "w-5" : "w-1.5 opacity-30",
                )}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Close tour"
            className="-m-1.5 rounded-full p-1.5 text-text-muted hover:bg-surface-sunken hover:text-text"
          >
            <X className="size-4" />
          </button>
        </div>

        <h3 className="mt-3 text-[17px] font-extrabold tracking-tight">{step.title}</h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">{step.body}</p>

        <button
          type="button"
          onClick={onNext}
          className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-full bg-forest-900 text-[13px] font-bold text-white transition-transform active:scale-95"
        >
          {index + 1 < total ? "Next" : "Got it"}
          <ArrowRight className="size-3.5" strokeWidth={2.6} />
        </button>
      </div>
    </div>
  );
}
