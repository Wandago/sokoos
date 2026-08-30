"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { SokoMark } from "@/components/soko-mark";
import { onboardingCards, themes } from "@/lib/onboarding";
import { cn } from "@/lib/cn";

export const ONBOARDED_KEY = "sokoos.onboarded";

export default function WelcomePage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const startX = useRef<number | null>(null);

  const card = onboardingCards[index];
  const theme = themes[card.theme];
  const last = index === onboardingCards.length - 1;

  const finish = useCallback(() => {
    try {
      window.localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {
      // Private mode: the tour simply shows again next time.
    }
    // The tour ends where the product begins: making an account, which is
    // also what creates the seller's mini site.
    router.push("/signup");
  }, [router]);

  const go = useCallback(
    (next: number) => setIndex(Math.min(onboardingCards.length - 1, Math.max(0, next))),
    [],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go]);

  return (
    <div className={cn("flex min-h-dvh flex-col transition-colors duration-300", theme.card)}>
      <div className="pt-safe" />

      <header className="flex items-center justify-between px-5 pt-4">
        <span className="flex items-center gap-2">
          <SokoMark className="size-8" />
          <span className={cn("text-[15px] font-extrabold tracking-tight", theme.text)}>SokoOS</span>
        </span>
        {!last && (
          <button
            onClick={finish}
            className={cn("text-[13px] font-semibold opacity-70 hover:opacity-100", theme.text)}
          >
            Skip
          </button>
        )}
      </header>

      {/* Swipe area. Touch on a phone, arrow keys on a desktop.
          Message first, then the picture — the reference cards lead with the
          promise, not the illustration. */}
      <div
        key={card.id}
        className="animate-rise flex min-h-0 flex-1 flex-col px-5 pt-7"
        onPointerDown={(e) => {
          startX.current = e.clientX;
        }}
        onPointerUp={(e) => {
          if (startX.current === null) return;
          const dx = e.clientX - startX.current;
          if (Math.abs(dx) > 48) go(dx < 0 ? index + 1 : index - 1);
          startX.current = null;
        }}
      >
        <div className="mx-auto w-full max-w-sm">
          <p
            className={cn("text-[11px] font-bold uppercase tracking-[0.14em] opacity-60", theme.text)}
          >
            {card.eyebrow}
          </p>
          <h1
            className={cn(
              "mt-2 text-[36px] font-extrabold leading-[1.02] tracking-[-0.04em]",
              theme.text,
            )}
          >
            {card.headline}
          </h1>
          <p className={cn("mt-3 text-[15px] leading-relaxed", theme.muted)}>{card.body}</p>
        </div>

        {/* The drawing sits straight on the card — its own palette flips per
            surface, so the whole screen stays one solid colour. */}
        <div className="flex min-h-0 flex-1 items-center justify-center py-4">
          <card.Spot surface={card.theme} className="h-full max-h-[46vh] w-auto max-w-sm" />
        </div>
      </div>

      <footer className="pb-safe px-5 pb-6 pt-7">
        <div className="mx-auto flex max-w-sm items-center justify-between gap-4">
          <div className="flex items-center gap-1.5" role="tablist" aria-label="Onboarding progress">
            {onboardingCards.map((c, i) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={i === index}
                aria-label={c.headline}
                onClick={() => go(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === index ? "w-6" : "w-1.5 opacity-35",
                  theme.dot,
                )}
              />
            ))}
          </div>

          <button
            onClick={() => (last ? finish() : go(index + 1))}
            className={cn(
              "inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-bold transition-transform active:scale-95",
              theme.chip,
            )}
          >
            {last ? "Create my account" : "Next"}
            {last ? <Check className="size-4" strokeWidth={3} /> : <ArrowRight className="size-4" strokeWidth={2.6} />}
          </button>
        </div>
      </footer>
    </div>
  );
}
