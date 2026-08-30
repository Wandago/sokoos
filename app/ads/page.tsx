"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Smartphone, Wifi, X } from "lucide-react";
import { SokoMark } from "@/components/soko-mark";
import {
  SpotAllInOne,
  SpotCapture,
  SpotConversation,
  SpotGrowth,
  SpotLedger,
  SpotPayment,
  SpotRider,
} from "@/components/spot";
import { cn } from "@/lib/cn";

/* The ad kit. Every creative is a real 9:16 frame at any zoom, so a card can be
 * screenshotted straight into a story slot. Colours cycle forest → lime → cream
 * so a row of them never reads as one block. */

type Surface = "forest" | "lime" | "cream" | "paper";

const surfaces: Record<Surface, { card: string; text: string; muted: string; chip: string }> = {
  forest: {
    card: "bg-forest-900",
    text: "text-white",
    muted: "text-forest-200",
    chip: "bg-brand text-brand-ink",
  },
  lime: {
    card: "bg-brand",
    text: "text-brand-ink",
    muted: "text-brand-ink/70",
    chip: "bg-forest-900 text-white",
  },
  cream: {
    card: "bg-[#EFF3E2]",
    text: "text-forest-950",
    muted: "text-forest-700",
    chip: "bg-forest-900 text-white",
  },
  paper: {
    card: "bg-white",
    text: "text-forest-950",
    muted: "text-forest-700",
    chip: "bg-brand text-brand-ink",
  },
};

/** 9:16 frame. Everything inside sizes in cq units so it scales as one piece. */
function Frame({
  surface,
  children,
  className,
}: {
  surface: Surface;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "@container relative aspect-[9/16] overflow-hidden rounded-[20px] shadow-overlay",
        surfaces[surface].card,
        className,
      )}
    >
      {children}
    </div>
  );
}

function Wordmark({ surface, className }: { surface: Surface; className?: string }) {
  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      <SokoMark className="size-[7cqw]" />
      <span className={cn("text-[5cqw] font-extrabold tracking-tight", surfaces[surface].text)}>
        SokoOS
      </span>
    </span>
  );
}

/** A PWA has no store listing, so the call to action is the address itself. */
function InstallChip({ surface }: { surface: Surface }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-[1.5cqw] self-start rounded-full px-[4cqw] py-[2.2cqw] text-[3.4cqw] font-bold",
        surfaces[surface].chip,
      )}
    >
      <Smartphone className="size-[4cqw]" />
      sokoos.app
    </span>
  );
}

/** Headline over an illustration — the workhorse creative. */
function StoryCard({
  surface,
  eyebrow,
  headline,
  body,
  Spot,
}: {
  surface: Surface;
  eyebrow: string;
  headline: string;
  body?: string;
  Spot: typeof SpotAllInOne;
}) {
  const s = surfaces[surface];
  return (
    <Frame surface={surface}>
      <div className="flex h-full flex-col p-[6cqw]">
        <Wordmark surface={surface} />
        <p
          className={cn(
            "mt-[6cqw] text-[3cqw] font-bold uppercase tracking-[0.16em] opacity-60",
            s.text,
          )}
        >
          {eyebrow}
        </p>
        <h2
          className={cn(
            "mt-[1.5cqw] text-[9.5cqw] font-extrabold leading-[1.0] tracking-[-0.04em]",
            s.text,
          )}
        >
          {headline}
        </h2>
        {body && <p className={cn("mt-[3cqw] text-[3.8cqw] leading-snug", s.muted)}>{body}</p>}
        <div className="flex min-h-0 flex-1 items-center justify-center py-[5cqw]">
          <Spot surface={surface} className="h-full w-auto" />
        </div>
        <InstallChip surface={surface} />
      </div>
    </Frame>
  );
}

/** Typographic creative: the claim, at size, nothing else. */
function StatementCard({
  surface,
  headline,
  kicker,
}: {
  surface: Surface;
  headline: string;
  kicker: string;
}) {
  const s = surfaces[surface];
  return (
    <Frame surface={surface}>
      <div className="flex h-full flex-col justify-between p-[6cqw]">
        <Wordmark surface={surface} />
        <h2
          className={cn(
            "text-[13cqw] font-extrabold leading-[0.98] tracking-[-0.05em]",
            s.text,
          )}
        >
          {headline}
        </h2>
        <div>
          <p className={cn("mb-[4cqw] text-[3.8cqw] font-medium leading-snug", s.muted)}>{kicker}</p>
          <InstallChip surface={surface} />
        </div>
      </div>
    </Frame>
  );
}

/** Proof creative: one number, said plainly. */
function ProofCard({
  surface,
  value,
  label,
  note,
}: {
  surface: Surface;
  value: string;
  label: string;
  note: string;
}) {
  const s = surfaces[surface];
  return (
    <Frame surface={surface}>
      <div className="flex h-full flex-col justify-between p-[6cqw]">
        <Wordmark surface={surface} />
        <div>
          <p className={cn("text-[3.4cqw] font-bold uppercase tracking-[0.16em] opacity-60", s.text)}>
            {label}
          </p>
          <p
            className={cn(
              "tabular mt-[2cqw] text-[14cqw] font-extrabold leading-[0.92] tracking-[-0.05em]",
              s.text,
            )}
          >
            {value}
          </p>
          <p className={cn("mt-[3cqw] text-[3.8cqw] leading-snug", s.muted)}>{note}</p>
        </div>
        <InstallChip surface={surface} />
      </div>
    </Frame>
  );
}

/** Before / after — the transformation the product actually sells. */
function BeforeAfterCard({ surface }: { surface: Surface }) {
  const s = surfaces[surface];
  const before = ["Screenshots", "Unread DMs", "M-Pesa SMS", "Paper receipts", "Guesswork"];
  const after = ["Orders", "Payments matched", "Riders assigned", "Ledger balanced", "Answers"];
  return (
    <Frame surface={surface}>
      <div className="flex h-full flex-col p-[6cqw]">
        <Wordmark surface={surface} />
        <h2 className={cn("mt-[6cqw] text-[8.5cqw] font-extrabold leading-[1.0] tracking-[-0.04em]", s.text)}>
          Turn the chaos into a business.
        </h2>
        <div className="mt-[5cqw] flex min-h-0 flex-1 gap-[3cqw]">
          <div className="flex-1">
            <p className={cn("mb-[2.5cqw] text-[3cqw] font-bold uppercase tracking-[0.14em]", s.muted)}>
              Before
            </p>
            <ul className="space-y-[2cqw]">
              {before.map((item) => (
                <li
                  key={item}
                  className={cn(
                    "rounded-[3cqw] bg-black/10 px-[3cqw] py-[2.2cqw] text-[3.2cqw] font-medium line-through",
                    s.muted,
                  )}
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex-1">
            <p className={cn("mb-[2.5cqw] text-[3cqw] font-bold uppercase tracking-[0.14em]", s.muted)}>
              After
            </p>
            <ul className="space-y-[2cqw]">
              {after.map((item) => (
                <li
                  key={item}
                  className="rounded-[3cqw] bg-brand px-[3cqw] py-[2.2cqw] text-[3.2cqw] font-bold text-brand-ink"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-[4cqw]">
          <InstallChip surface={surface} />
        </div>
      </div>
    </Frame>
  );
}

/** Offline claim — the thing no competitor on a bad network can say. */
function OfflineCard({ surface }: { surface: Surface }) {
  const s = surfaces[surface];
  return (
    <Frame surface={surface}>
      <div className="flex h-full flex-col justify-between p-[6cqw]">
        <Wordmark surface={surface} />
        <div className="flex flex-col items-start">
          <span className="flex size-[16cqw] items-center justify-center rounded-[5cqw] bg-brand text-brand-ink">
            <Wifi className="size-[9cqw]" strokeWidth={2.4} />
          </span>
          <h2
            className={cn(
              "mt-[5cqw] text-[10cqw] font-extrabold leading-[1.0] tracking-[-0.04em]",
              s.text,
            )}
          >
            Works with one bar of signal.
          </h2>
          <p className={cn("mt-[3cqw] text-[3.8cqw] leading-snug", s.muted)}>
            Your orders, payments and ledger live on the phone. No network, no problem.
          </p>
        </div>
        <InstallChip surface={surface} />
      </div>
    </Frame>
  );
}

interface Creative {
  id: string;
  node: React.ReactNode;
}

const creatives: Creative[] = [
  {
    id: "every-sale",
    node: (
      <StatementCard
        surface="lime"
        headline="Every sale. One place."
        kicker="The operating system for businesses that sell everywhere."
      />
    ),
  },
  {
    id: "dm-to-delivery",
    node: (
      <StoryCard
        surface="forest"
        eyebrow="Orders"
        headline="From DM to delivery."
        body="Turn a conversation into an order in three taps."
        Spot={SpotConversation}
      />
    ),
  },
  {
    id: "recovered",
    node: (
      <ProofCard
        surface="cream"
        label="Recovered last month"
        value="KES 7,700"
        note="Payments that never made it into the books — found, matched and filed."
      />
    ),
  },
  {
    id: "snap-it",
    node: (
      <StoryCard
        surface="cream"
        eyebrow="Smart Capture"
        headline="Snap it. We organise it."
        body="Receipts and M-Pesa messages become records."
        Spot={SpotCapture}
      />
    ),
  },
  { id: "before-after", node: <BeforeAfterCard surface="forest" /> },
  {
    id: "rider",
    node: (
      <StoryCard
        surface="lime"
        eyebrow="Delivery"
        headline="Rider’s on the way."
        body="Assign by area. See what’s on the road."
        Spot={SpotRider}
      />
    ),
  },
  { id: "offline", node: <OfflineCard surface="forest" /> },
  {
    id: "books",
    node: (
      <StoryCard
        surface="paper"
        eyebrow="Your books"
        headline="Your books are up to date."
        body="Money in, money out, and what each sale earned."
        Spot={SpotLedger}
      />
    ),
  },
  {
    id: "sell-everywhere",
    node: (
      <StatementCard
        surface="lime"
        headline="Sell everywhere. Run it here."
        kicker="Instagram, TikTok, WhatsApp, calls, walk-ins — one book."
      />
    ),
  },
  {
    id: "who-paid",
    node: (
      <StoryCard
        surface="forest"
        eyebrow="Payments"
        headline="Know who has paid."
        body="M-Pesa, cash and bank, each matched to its order."
        Spot={SpotPayment}
      />
    ),
  },
  {
    id: "what-sells",
    node: (
      <StoryCard
        surface="cream"
        eyebrow="Analytics"
        headline="See what actually sells."
        body="Which channel, which product, which customer."
        Spot={SpotGrowth}
      />
    ),
  },
  {
    id: "one-place",
    node: (
      <StoryCard
        surface="lime"
        eyebrow="Welcome"
        headline="Your business, finally in one place."
        body="Set up in a minute. Works offline."
        Spot={SpotAllInOne}
      />
    ),
  },
];

export default function AdKitPage() {
  const [zoomed, setZoomed] = useState<string | null>(null);
  const open = creatives.find((c) => c.id === zoomed);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomed(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-h-dvh bg-forest-950 pb-20">
      <header className="mx-auto max-w-7xl px-5 pb-8 pt-10 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="flex items-center gap-2.5">
              <SokoMark className="size-10" />
              <span className="text-[17px] font-extrabold tracking-tight text-white">SokoOS</span>
            </span>
            <h1 className="mt-4 text-[34px] font-extrabold leading-[1.05] tracking-[-0.04em] text-white sm:text-[44px]">
              Ad kit.
            </h1>
            <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-forest-200">
              Twelve story creatives at 9:16, built from the same components as the app — so the ad
              and the product never drift apart. Tap one to open it at full size and screenshot it.
            </p>
          </div>
          <a
            href="/welcome/"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-[14px] font-bold text-brand-ink"
          >
            See the onboarding
            <ArrowRight className="size-4" strokeWidth={2.6} />
          </a>
        </div>
        <p className="mt-6 text-[12px] text-forest-200/70">
          The call to action is the address, not a store badge — SokoOS installs from the browser.
        </p>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-5 sm:grid-cols-3 sm:px-8 lg:grid-cols-4 xl:grid-cols-6">
        {creatives.map((creative) => (
          <button
            key={creative.id}
            onClick={() => setZoomed(creative.id)}
            aria-label={`Open ${creative.id} at full size`}
            className="block w-full rounded-[20px] text-left transition-transform duration-200 hover:-translate-y-1"
          >
            {creative.node}
          </button>
        ))}
      </div>

      {open && (
        <div
          className="animate-fade fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setZoomed(null)}
        >
          <div
            className="animate-rise h-full max-h-[92vh]"
            style={{ aspectRatio: "9 / 16" }}
            onClick={(e) => e.stopPropagation()}
          >
            {open.node}
          </div>
          <button
            onClick={() => setZoomed(null)}
            aria-label="Close"
            className="absolute right-5 top-5 inline-flex size-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <X className="size-5" />
          </button>
        </div>
      )}
    </div>
  );
}
