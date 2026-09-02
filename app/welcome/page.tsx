"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { SokoMark } from "@/components/soko-mark";
import { Deck } from "@/components/ui/deck";
import { onboardingCards, themes } from "@/lib/onboarding";
import { cn } from "@/lib/cn";

export const ONBOARDED_KEY = "sokoos.onboarded";

/**
 * The tour.
 *
 * Rebuilt as a deck you scroll rather than a slideshow you advance. The
 * difference matters more than it looks: a slideshow hides how long it is, so
 * every tap is a small gamble on whether this ends soon. A deck shows the whole
 * set at once — seven cards, one thumb-flick apart — and the seller can read
 * two and leave, which is the honest bargain for a tour nobody asked for.
 *
 * The page itself stays neutral. Colour belongs to the cards, so the eye goes
 * to them and not to a background that changes under it.
 */
export default function WelcomePage() {
  const router = useRouter();
  const [seen, setSeen] = useState(0);
  const track = useRef<HTMLDivElement>(null);

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

  /* Which card is roughly in view, for the progress dots. Read from scroll
   * position rather than driving it, so a flick that lands between two cards
   * still lights the nearer dot instead of fighting the browser's snapping. */
  useEffect(() => {
    const el = track.current?.querySelector<HTMLElement>(".deck");
    if (!el) return;
    const onScroll = () => {
      const step = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? 1;
      setSeen(Math.round(el.scrollLeft / (step + 12)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <div className="pt-safe" />

      <header className="flex items-center justify-between px-5 pt-4">
        <span className="flex items-center gap-2">
          <SokoMark className="size-8" />
          <span className="text-[15px] font-extrabold tracking-tight">SokoOS</span>
        </span>
        <button
          onClick={finish}
          className="text-[13px] font-semibold text-text-secondary hover:text-text"
        >
          Skip
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-5 pb-4 pt-8">
        <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-text-muted">
            Welcome to SokoOS
          </p>
          <h1 className="mt-2 max-w-[13ch] text-[34px] font-extrabold leading-[0.98] tracking-[-0.045em] lg:text-[54px]">
            Everything your shop does, in one book.
          </h1>

          {/* The deck takes whatever height is left, and the cards stretch to
              fill it — so the picture grows on a tall phone instead of leaving
              a band of empty page under the deck. */}
          <div ref={track} className="mt-6 flex min-h-0 flex-1 flex-col">
            <Deck
              label="What SokoOS does"
              className="flex min-h-0 flex-1 flex-col"
              trackClassName="min-h-0 flex-1 items-stretch"
              title={<span className="sr-only">Features</span>}
            >
              {onboardingCards.map((card) => {
                const t = themes[card.theme];
                return (
                  <article
                    key={card.id}
                    className={cn(
                      "card-press flex w-[76vw] max-w-[19rem] flex-col overflow-hidden rounded-[1.75rem]",
                      t.card,
                    )}
                  >
                    <div className="px-4 pt-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {card.tags.map((tag) => (
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

                      <h2
                        className={cn(
                          "mt-3.5 text-[27px] font-extrabold leading-[1.02] tracking-[-0.04em]",
                          t.text,
                        )}
                      >
                        {card.headline}
                      </h2>
                      <p className={cn("mt-2 text-[13px] leading-relaxed", t.muted)}>{card.body}</p>
                    </div>

                    {/* The drawing owns the lower half, the way the photograph
                        does on the cards this is modelled on. A tinted panel
                        rather than a second colour, so the card still reads as
                        one surface with a picture set into it. */}
                    <div className="mt-auto flex min-h-0 flex-1 p-3 pt-4">
                      <div
                        className={cn(
                          "grid min-h-[7rem] w-full place-items-center overflow-hidden rounded-[1.25rem]",
                          t.panel,
                        )}
                      >
                        <card.Spot surface={card.theme} className="h-[88%] max-h-52 w-auto" />
                      </div>
                    </div>
                  </article>
                );
              })}
            </Deck>
          </div>
        </div>
      </div>

      <footer className="pb-safe px-5 pb-6 pt-2">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-center gap-1.5" aria-hidden>
            {onboardingCards.map((c, i) => (
              <span
                key={c.id}
                className={cn(
                  "h-1.5 rounded-full bg-forest-900 transition-all duration-300",
                  i === seen ? "w-6" : "w-1.5 opacity-25",
                )}
              />
            ))}
          </div>

          <button
            onClick={finish}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-forest-900 px-6 text-[15px] font-bold text-white transition-transform active:scale-95"
          >
            Create my account
            <ArrowRight className="size-4" strokeWidth={2.6} />
          </button>
        </div>
      </footer>
    </div>
  );
}
