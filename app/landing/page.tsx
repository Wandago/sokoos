"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bike,
  BookOpen,
  Check,
  MessageCircle,
  Package,
  Play,
  Wallet,
  Wifi,
} from "lucide-react";
import { SokoMark } from "@/components/soko-mark";
import { PhoneMock } from "@/components/phone-mock";
import { SpotCapture, SpotGrowth, SpotLedger, SpotReceipt, SpotRider } from "@/components/spot";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";

const nav = [
  { href: "#how", label: "How it works" },
  { href: "#features", label: "Features" },
  { href: "#steps", label: "Get started" },
  { href: "#pricing", label: "Pricing" },
];

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-white text-forest-950">
      {/* ---- Nav ------------------------------------------------------- */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-forest-950/90 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3.5 sm:px-8">
          <Link href="/landing" className="flex shrink-0 items-center gap-2.5">
            <SokoMark className="size-9" />
            <span className="text-[17px] font-extrabold tracking-tight text-white">SokoOS</span>
          </Link>
          <nav className="ml-6 hidden flex-1 items-center gap-7 lg:flex">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-[14px] font-medium text-forest-200 transition-colors hover:text-white"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2.5">
            <Link
              href="/"
              className="hidden h-10 items-center rounded-full px-4 text-[14px] font-semibold text-white hover:bg-white/10 sm:inline-flex"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-[14px] font-bold text-brand-ink transition-[filter] hover:brightness-95"
            >
              Get started
            </Link>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
              aria-expanded={menuOpen}
              className="inline-flex size-10 items-center justify-center rounded-full text-white hover:bg-white/10 lg:hidden"
            >
              <span className="space-y-1">
                <span className="block h-0.5 w-4 rounded bg-current" />
                <span className="block h-0.5 w-4 rounded bg-current" />
              </span>
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="border-t border-white/10 px-5 py-3 lg:hidden">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className="block py-2.5 text-[15px] font-medium text-forest-200"
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
      </header>

      {/* ---- Hero ------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-forest-950 pb-24 pt-14 sm:pt-20">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 size-[680px] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--lime-500), transparent 65%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(var(--lime-500) 1px, transparent 1px), linear-gradient(90deg, var(--lime-500) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />

        <div className="relative mx-auto max-w-6xl px-5 text-center sm:px-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[12px] font-semibold text-forest-200">
            <span className="size-1.5 rounded-full bg-brand" />
            Built for Kenyan social sellers
          </span>

          <h1 className="mx-auto mt-6 max-w-4xl text-[40px] font-extrabold leading-[1.02] tracking-[-0.045em] text-white sm:text-[64px]">
            Every sale.{" "}
            <span className="text-brand">One place.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-forest-200 sm:text-[18px]">
            The operating system for businesses that sell everywhere. Turn Instagram, TikTok and
            WhatsApp conversations into orders, payments, deliveries and a ledger that balances
            itself.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-brand px-6 text-[15px] font-bold text-brand-ink transition-[filter] hover:brightness-95"
            >
              Start free
              <ArrowRight className="size-4" strokeWidth={2.6} />
            </Link>
            <Link
              href="/"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-white/20 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
            >
              <span className="flex size-6 items-center justify-center rounded-full bg-white/15">
                <Play className="size-3 fill-current" />
              </span>
              See the app
            </Link>
          </div>

          <p className="mt-5 text-[13px] text-forest-200/70">
            No card. No download. Works on any phone, even offline.
          </p>

          {/* Product, surrounded by the moments it handles. */}
          <div className="relative mx-auto mt-14 flex max-w-4xl justify-center">
            <FloatCard className="absolute -left-2 top-10 hidden lg:flex" tone="paper">
              <span className="flex size-8 items-center justify-center rounded-full bg-brand text-brand-ink">
                <MessageCircle className="size-4" strokeWidth={2.4} />
              </span>
              <span>
                <span className="block text-[11px] text-[#5B665A]">New on Instagram</span>
                <span className="block text-[13px] font-bold">“Is this still available?”</span>
              </span>
            </FloatCard>

            <FloatCard className="absolute -right-2 top-24 hidden lg:flex" tone="paper">
              <span className="flex size-8 items-center justify-center rounded-full bg-brand text-brand-ink">
                <Wallet className="size-4" strokeWidth={2.4} />
              </span>
              <span>
                <span className="block text-[11px] text-[#5B665A]">M-Pesa received</span>
                <span className="tabular block text-[13px] font-bold">KES 6,900 · matched</span>
              </span>
            </FloatCard>

            <FloatCard className="absolute bottom-16 -left-6 hidden lg:flex" tone="lime">
              <span className="flex size-8 items-center justify-center rounded-full bg-forest-900 text-brand">
                <Bike className="size-4" strokeWidth={2.4} />
              </span>
              <span>
                <span className="block text-[11px] opacity-70">Musa Abdi</span>
                <span className="block text-[13px] font-bold">Rider’s on the way</span>
              </span>
            </FloatCard>

            <FloatCard className="absolute bottom-24 -right-6 hidden lg:flex" tone="paper">
              <span className="flex size-8 items-center justify-center rounded-full bg-brand text-brand-ink">
                <BookOpen className="size-4" strokeWidth={2.4} />
              </span>
              <span>
                <span className="block text-[11px] text-[#5B665A]">Ledger</span>
                <span className="block text-[13px] font-bold">Books up to date</span>
              </span>
            </FloatCard>

            <PhoneMock />
          </div>
        </div>
      </section>

      {/* ---- Channels ---------------------------------------------------- */}
      <section className="border-b border-[#E8ECE7] bg-white py-10">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <p className="text-center text-[12px] font-bold uppercase tracking-[0.16em] text-[#5B665A]">
            Every channel you already sell on
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
            {["Instagram", "TikTok", "WhatsApp", "Facebook", "M-Pesa", "Phone calls", "Walk-ins"].map(
              (channel) => (
                <span
                  key={channel}
                  className="text-[17px] font-bold tracking-tight text-[#647063] transition-colors hover:text-forest-700 sm:text-[19px]"
                >
                  {channel}
                </span>
              ),
            )}
          </div>
        </div>
      </section>

      {/* ---- How it works ------------------------------------------------ */}
      <section id="how" className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="mt-5 max-w-3xl text-[32px] font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-[46px]">
            One thread from <span className="text-forest-500">the first message</span> to the money
            in your <span className="text-forest-500">ledger</span>.
          </h2>
          <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-[#5B665A]">
            Nothing to reconcile at the end of the week, because nothing ever left the system.
          </p>

          <ol className="mt-12 grid gap-4 md:grid-cols-4">
            {[
              { icon: MessageCircle, title: "The chat", body: "A DM, a call, a WhatsApp. It lands in one inbox." },
              { icon: Package, title: "The order", body: "Three taps: customer, items, address. Done." },
              { icon: Wallet, title: "The money", body: "M-Pesa, cash or bank, matched to its order." },
              { icon: Bike, title: "The delivery", body: "A trusted rider by area, tracked to the door." },
            ].map((step, i) => (
              <li
                key={step.title}
                className="relative rounded-[22px] border border-[#E8ECE7] bg-[#F7F9F5] p-5"
              >
                <span className="tabular text-[12px] font-extrabold text-[#647063]">
                  0{i + 1}
                </span>
                <span className="mt-3 flex size-11 items-center justify-center rounded-2xl bg-brand text-brand-ink">
                  <step.icon className="size-5" strokeWidth={2.2} />
                </span>
                <h3 className="mt-4 text-[17px] font-bold tracking-tight">{step.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[#5B665A]">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---- Features ---------------------------------------------------- */}
      <section id="features" className="bg-[#F1F3EF] py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <SectionLabel>Features</SectionLabel>
              <h2 className="mt-5 max-w-2xl text-[32px] font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-[44px]">
                Everything the business needs. Nothing it doesn’t.
              </h2>
            </div>
            <Link
              href="/"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-forest-900 px-5 text-[14px] font-bold text-white"
            >
              Explore the app
              <ArrowUpRight className="size-4" strokeWidth={2.5} />
            </Link>
          </div>

          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            <FeatureCard
              tone="lime"
              eyebrow="Smart Capture"
              tags={["Camera", "Voice"]}
              title="Snap it. We organise it."
              body="Photograph a receipt or an M-Pesa message. The amount, date, merchant and transaction ID are read, matched to an order, and filed — with a confidence score you can check."
              Spot={SpotCapture}
              wide
              className="lg:col-span-2"
            />
            <FeatureCard
              tone="forest"
              eyebrow="Deliveries"
              tags={["Boda"]}
              title="Rider’s on the way."
              body="Assign by area and see what’s on the road."
              Spot={SpotRider}
            />
            <FeatureCard
              tone="cream"
              eyebrow="Receipts"
              tags={["They can check it"]}
              title="Proof, not paper."
              body="Every payment gets a receipt carrying its M-Pesa code, so a customer can check it against the message already on their phone. Cash says plainly that it is your own record — because a receipt that looks official either way teaches people that official means nothing."
              Spot={SpotReceipt}
              wide
              className="lg:col-span-2"
            />
            <FeatureCard
              tone="forest"
              eyebrow="Ledger"
              title="Books that keep themselves."
              body="Cost of goods and rider payouts post automatically, so profit means something."
              Spot={SpotLedger}
            />
            <FeatureCard
              tone="cream"
              eyebrow="Analytics"
              tags={["Per channel"]}
              title="See what actually sells."
              body="Which channel brings the money, which product moves, which customer comes back — and what your average order is really worth."
              Spot={SpotGrowth}
              wide
              className="lg:col-span-2"
            />
          </div>
        </div>
      </section>

      {/* ---- Offline ------------------------------------------------------ */}
      <section className="bg-white py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-2">
          <div>
            <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-brand text-brand-ink">
              <Wifi className="size-6" strokeWidth={2.3} />
            </span>
            <h2 className="mt-6 text-[32px] font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-[42px]">
              Works with one bar of signal.
            </h2>
            <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-[#5B665A]">
              SokoOS installs from the browser and runs from your home screen. Your orders,
              payments and ledger live on the phone — so a matatu tunnel, a power cut or a bundle
              that ran out never stops you taking an order.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                "Installs in seconds, no app store",
                "Every screen works offline",
                "Your data stays on your device",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-[15px] font-medium">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-center">
            <SpotLedger surface="paper" className="h-64 w-auto sm:h-72" />
          </div>
        </div>
      </section>

      {/* ---- Steps ------------------------------------------------------- */}
      <section id="steps" className="bg-brand py-20 text-brand-ink sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2">
          <div className="flex justify-center lg:justify-start">
            <PhoneMock />
          </div>
          <div>
            <SectionLabel tone="ink">Get started</SectionLabel>
            <h2 className="mt-5 text-[32px] font-extrabold leading-[1.06] tracking-[-0.035em] sm:text-[44px]">
              Running your business in three steps.
            </h2>
            <ol className="mt-9 space-y-6">
              {[
                {
                  title: "Add what you sell",
                  body: "Your products, prices and stock. Two minutes, and every order after that is a tap.",
                },
                {
                  title: "Take your next order",
                  body: "From a DM, a call or a walk-in. The customer, items and address travel with it.",
                },
                {
                  title: "Let the books keep themselves",
                  body: "Payments match, deliveries close, and the ledger posts what each sale actually earned.",
                },
              ].map((step, i) => (
                <li key={step.title} className="flex gap-4">
                  <span className="tabular flex size-9 shrink-0 items-center justify-center rounded-full bg-forest-900 text-[14px] font-extrabold text-brand">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-[18px] font-bold tracking-tight">{step.title}</h3>
                    <p className="mt-1 text-[15px] leading-relaxed text-brand-ink/70">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link
              href="/signup"
              className="mt-9 inline-flex h-12 items-center gap-2 rounded-full bg-forest-900 px-6 text-[15px] font-bold text-white"
            >
              Start free
              <ArrowRight className="size-4" strokeWidth={2.6} />
            </Link>
          </div>
        </div>
      </section>

      {/* ---- Pricing ----------------------------------------------------- */}
      <section id="pricing" className="bg-white py-20 sm:py-24">
        <div className="mx-auto max-w-6xl px-5 text-center sm:px-8">
          <SectionLabel center>Pricing</SectionLabel>
          <h2 className="mx-auto mt-5 max-w-2xl text-[32px] font-extrabold leading-[1.08] tracking-[-0.035em] sm:text-[44px]">
            Free while you find your feet.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[16px] leading-relaxed text-[#5B665A]">
            Start on the free plan and stay there until the business outgrows it. No card, no
            trial clock.
          </p>

          <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
            <PriceCard
              name="Starter"
              price="Free"
              note="For the business finding its rhythm"
              features={["Unlimited orders", "Payments and matching", "Ledger and analytics", "Works offline"]}
              cta="Start free"
              href="/signup"
            />
            <PriceCard
              name="Growth"
              price="KES 1,500"
              suffix="/month"
              note="For the business with a team"
              features={["Everything in Starter", "Smart Capture at volume", "Rider management", "Multiple users"]}
              cta="Talk to us"
              href="/signup"
              comingSoon
              featured
            />
          </div>
        </div>
      </section>

      {/* ---- Final CTA --------------------------------------------------- */}
      <section className="bg-white pb-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="relative overflow-hidden rounded-[32px] bg-forest-950 px-6 py-16 text-center sm:px-12">
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-24 left-1/2 size-96 -translate-x-1/2 rounded-full opacity-35 blur-3xl"
              style={{ background: "radial-gradient(circle, var(--lime-500), transparent 65%)" }}
            />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-[32px] font-extrabold leading-[1.06] tracking-[-0.04em] text-white sm:text-[46px]">
                Turn the chaos into a business.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-[16px] leading-relaxed text-forest-200">
                Your sales, your payments, your riders and your books — finally in one place.
              </p>
              <Link
                href="/signup"
                className="mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-brand px-7 text-[15px] font-bold text-brand-ink"
              >
                Start free
                <ArrowRight className="size-4" strokeWidth={2.6} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ---- Footer ------------------------------------------------------ */}
      <footer className="border-t border-[#E8ECE7] bg-white py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 sm:flex-row sm:px-8">
          <span className="flex items-center gap-2.5">
            <SokoMark className="size-8" />
            <span className="text-[15px] font-extrabold tracking-tight">SokoOS</span>
          </span>
          <p className="text-[13px] text-[#5B665A]">
            Made in Nairobi for businesses that sell everywhere.
          </p>
          <div className="flex items-center gap-4 text-[13px] font-medium text-[#5B665A]">
            <Link href="/ads" className="hover:text-forest-950">
              Ad kit
            </Link>
            <Link href="/signup" className="hover:text-forest-950">
              Onboarding
            </Link>
            <Link href="/" className="hover:text-forest-950">
              Open the app
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionLabel({
  children,
  tone = "default",
  center,
}: {
  children: React.ReactNode;
  tone?: "default" | "ink";
  center?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-[0.14em]",
        tone === "ink" ? "bg-forest-900 text-brand" : "bg-brand text-brand-ink",
        center && "mx-auto",
      )}
    >
      {children}
    </span>
  );
}

function FloatCard({
  children,
  className,
  tone,
}: {
  children: React.ReactNode;
  className?: string;
  tone: "paper" | "lime";
}) {
  return (
    <div
      className={cn(
        "z-10 items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left shadow-overlay",
        tone === "paper" ? "bg-white text-forest-950" : "bg-brand text-brand-ink",
        className,
      )}
    >
      {children}
    </div>
  );
}

const featureTones = {
  lime: {
    card: "bg-brand text-brand-ink",
    muted: "text-brand-ink/70",
    chip: "bg-brand-ink/10 text-brand-ink",
    panel: "bg-white/35",
    surface: "lime" as const,
  },
  forest: {
    card: "bg-forest-900 text-white",
    muted: "text-forest-200",
    chip: "bg-white/12 text-white",
    panel: "bg-forest-950/45",
    surface: "forest" as const,
  },
  cream: {
    card: "bg-white text-forest-950",
    muted: "text-[#5B665A]",
    chip: "bg-forest-900/8 text-forest-900",
    panel: "bg-[#F1F3EF]",
    surface: "paper" as const,
  },
};

function FeatureCard({
  tone,
  eyebrow,
  title,
  body,
  Spot,
  tags,
  /** Only the two-column cards have room to sit the art beside the copy. */
  wide,
  className,
}: {
  tone: keyof typeof featureTones;
  eyebrow: string;
  title: string;
  body: string;
  Spot: typeof SpotCapture;
  /** Extra pills beside the eyebrow, in the style of the reference cards. */
  tags?: string[];
  wide?: boolean;
  className?: string;
}) {
  const t = featureTones[tone];
  return (
    <div
      className={cn(
        "card-press flex flex-col gap-5 rounded-[26px] p-5",
        wide && "sm:flex-row sm:items-center sm:gap-6",
        t.card,
        className,
      )}
    >
      <div className="min-w-0 flex-1 px-1 pt-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {[eyebrow, ...(tags ?? [])].map((tag) => (
            <span
              key={tag}
              className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold tracking-tight", t.chip)}
            >
              {tag}
            </span>
          ))}
        </div>
        <h3 className="mt-3.5 text-[24px] font-extrabold leading-tight tracking-[-0.03em]">
          {title}
        </h3>
        <p className={cn("mt-3 text-[15px] leading-relaxed", t.muted)}>{body}</p>
      </div>
      <div
        className={cn(
          "grid h-44 w-full shrink-0 place-items-center rounded-[18px]",
          t.panel,
          wide && "sm:h-48 sm:w-48",
        )}
      >
        <Spot surface={t.surface} className="h-[84%] w-auto" />
      </div>
    </div>
  );
}

function PriceCard({
  name,
  price,
  suffix,
  note,
  features,
  cta,
  href,
  featured,
  comingSoon,
}: {
  name: string;
  price: string;
  suffix?: string;
  note: string;
  features: string[];
  cta: string;
  href: string;
  featured?: boolean;
  comingSoon?: boolean;
}) {
  const toast = useToast();
  return (
    <div
      className={cn(
        "rounded-[26px] p-6 text-left",
        featured ? "bg-forest-950 text-white" : "border border-[#E8ECE7] bg-[#F7F9F5]",
      )}
    >
      <p
        className={cn(
          "text-[12px] font-bold uppercase tracking-[0.14em]",
          featured ? "text-brand" : "text-[#5B665A]",
        )}
      >
        {name}
      </p>
      <p className="tabular mt-3 text-[36px] font-extrabold leading-none tracking-[-0.04em]">
        {price}
        {suffix && (
          <span
            className={cn(
              "ml-1 text-[15px] font-semibold",
              featured ? "text-forest-200" : "text-[#5B665A]",
            )}
          >
            {suffix}
          </span>
        )}
      </p>
      <p className={cn("mt-2 text-[14px]", featured ? "text-forest-200" : "text-[#5B665A]")}>
        {note}
      </p>
      <ul className="mt-6 space-y-2.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2.5 text-[14px]">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink">
              <Check className="size-3" strokeWidth={3.2} />
            </span>
            {feature}
          </li>
        ))}
      </ul>
      {comingSoon ? (
        <button
          type="button"
          onClick={() => toast("Growth plan sign-up is coming soon — the app is free for now.", "info")}
          className={cn(
            "mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-[14px] font-bold",
            featured ? "bg-brand text-brand-ink" : "bg-forest-900 text-white",
          )}
        >
          {cta}
          <ArrowRight className="size-4" strokeWidth={2.5} />
        </button>
      ) : (
        <Link
          href={href}
          className={cn(
            "mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-[14px] font-bold",
            featured ? "bg-brand text-brand-ink" : "bg-forest-900 text-white",
          )}
        >
          {cta}
          <ArrowRight className="size-4" strokeWidth={2.5} />
        </Link>
      )}
    </div>
  );
}
