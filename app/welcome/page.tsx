"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { SokoMark } from "@/components/soko-mark";
import { Deck, DeckCard, surfaceForTone } from "@/components/ui/deck";
import { Hydrated } from "@/components/ui/hydrated";
import { onboardingCards } from "@/lib/onboarding";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/cn";

export const ONBOARDED_KEY = "sokoos.onboarded";

/**
 * The tour — met right after signup, not before it.
 *
 * A visitor who hasn't committed to anything yet will not spend a card's
 * worth of attention on a slideshow; a seller who just typed their business
 * name into a form will, for a few seconds, because they are curious what
 * they signed up for. So the account exists before this screen ever shows.
 *
 * Built on the same `Deck`/`DeckCard` the rest of the app uses for a
 * horizontal card row, rather than a bespoke full-bleed slide. That fixes a
 * real problem the bespoke version had: a card whose illustration panel
 * stretched to fill whatever height was left on a tall phone, leaving a
 * small icon lost in a mostly-empty dark rectangle. `DeckCard`'s panel is a
 * fixed 4:3, so the picture is always the right size for the frame it sits
 * in, on any screen.
 */
export default function WelcomePage() {
  return (
    <Hydrated fallback={<div className="min-h-dvh bg-bg" />}>
      <Welcome />
    </Hydrated>
  );
}

function Welcome() {
  const router = useRouter();
  const { db } = useStore();
  const [seen, setSeen] = useState(0);
  const track = useRef<HTMLDivElement>(null);

  // Reached without an account — a stale bookmark or a manual URL — sends
  // the visitor to make one, which is the only door into this screen now.
  useEffect(() => {
    if (!db.account) router.replace("/signup");
  }, [db.account, router]);

  const finish = useCallback(() => {
    try {
      window.localStorage.setItem(ONBOARDED_KEY, "1");
    } catch {
      // Private mode: the tour simply shows again next time.
    }
    // The account already exists; the tour ends at the shop it just made.
    router.push("/storefront/?new=1");
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

  if (!db.account) return <div className="min-h-dvh bg-bg" />;

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

      <div className="flex flex-1 flex-col px-5 pb-4 pt-8">
        <div className="mx-auto w-full max-w-5xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-text-muted">
            You&rsquo;re in, {db.account.name.split(" ")[0]}
          </p>
          <h1 className="mt-2 max-w-[15ch] text-[30px] font-extrabold leading-[1.04] tracking-[-0.04em] lg:text-[44px]">
            Here&rsquo;s everything {db.business.name} can do.
          </h1>

          <div ref={track} className="mt-7">
            <Deck label="What SokoOS does" title={<span className="sr-only">Features</span>}>
              {onboardingCards.map((card) => (
                <DeckCard
                  key={card.id}
                  tone={card.theme}
                  tags={card.tags}
                  title={card.headline}
                  body={card.body}
                  width="w-[74vw] max-w-[18rem]"
                  illustration={
                    <card.Spot surface={surfaceForTone[card.theme]} className="h-[74%] w-auto" />
                  }
                />
              ))}
            </Deck>
          </div>
        </div>
      </div>

      <footer className="pb-safe px-5 pb-6 pt-4">
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
            See my shop
            <ArrowRight className="size-4" strokeWidth={2.6} />
          </button>
        </div>
      </footer>
    </div>
  );
}
