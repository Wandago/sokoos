"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Brain,
  Calculator,
  ChevronRight,
  CircleAlert,
  Coins,
  TriangleAlert,
} from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/ui/page";
import { Hydrated } from "@/components/ui/hydrated";
import { ListSkeleton } from "@/components/ui/state";
import { Card } from "@/components/ui/card";
import { RankedBars } from "@/components/ui/chart";
import { useStore } from "@/lib/store";
import {
  cashPosition,
  cfoFindings,
  costPerShilling,
  coverage,
  expenseMix,
  type Finding,
  type Severity,
} from "@/lib/cfo";
import { money } from "@/lib/format";
import { cn } from "@/lib/cn";

export default function CfoPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Hydrated>
        <CfoScreen />
      </Hydrated>
    </Suspense>
  );
}

const severityMeta: Record<
  Severity,
  { icon: typeof CircleAlert; skin: string; label: string }
> = {
  urgent: {
    icon: TriangleAlert,
    skin: "bg-danger-soft text-danger-text",
    label: "Deal with this",
  },
  watch: { icon: CircleAlert, skin: "bg-pending-soft text-pending-text", label: "Keep an eye on" },
  good: { icon: BadgeCheck, skin: "bg-success-soft text-success-text", label: "Worth knowing" },
};

function CfoScreen() {
  const { db } = useStore();

  const cash = useMemo(() => cashPosition(db), [db]);
  const cover = useMemo(() => coverage(db), [db]);
  const mix = useMemo(() => expenseMix(db), [db]);
  const findings = useMemo(() => cfoFindings(db), [db]);
  const per = costPerShilling(db);

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <>
      <PageHeader
        title="Your CFO"
        subtitle="Every shilling in and out of the business, read the way a finance director would read it. Nothing here is a guess — each figure shows its working."
      />

      {/* The headline: what the business actually kept. */}
      <div className="relative mb-5 overflow-hidden rounded-card bg-panel p-5 text-panel-text shadow-float ring-1 ring-white/5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full opacity-30 blur-2xl"
          style={{ background: "radial-gradient(circle, var(--lime-500), transparent 70%)" }}
        />
        <div className="relative">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-brand text-brand-ink">
              <Brain className="size-4" strokeWidth={2.2} />
            </span>
            <p className="text-[12px] font-semibold text-panel-muted">
              {greeting}. Last 30 days.
            </p>
          </div>

          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-panel-muted">
            You kept
          </p>
          <p className="tabular mt-1 text-[34px] font-extrabold leading-none tracking-[-0.03em]">
            {money(cash.net)}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-panel-muted">
            {money(cash.income)} came in, {money(cash.expenses)} went out. Of every shilling you
            took, {Math.round(per.expenses * 100)} cents went straight back out and you kept{" "}
            {Math.round(per.kept * 100)}.
          </p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <PanelFigure label="Out per day" value={money(cash.burnPerDay, { compact: true })} />
            <PanelFigure
              label="Cushion"
              value={cash.cushionDays > 0 ? `${Math.round(cash.cushionDays)} days` : "None"}
            />
            <PanelFigure label="Reconciled" value={`${cover.percent.toFixed(0)}%`} />
          </div>
          <p className="mt-2.5 text-[11px] leading-relaxed text-panel-muted">
            Cushion is what your surplus would cover if the money stopped coming in today. It is
            arithmetic, not a forecast.
          </p>
        </div>
      </div>

      <SectionTitle>The brief</SectionTitle>
      <div className="mb-7 space-y-2.5">
        {findings.length ? (
          findings.map((finding) => <FindingCard key={finding.id} finding={finding} />)
        ) : (
          <Card>
            <div className="flex gap-3 p-4">
              <BadgeCheck className="size-5 shrink-0 text-success" />
              <p className="text-[13px] leading-relaxed text-text-secondary">
                Nothing needs your attention. Your books balance, every payment is matched and no
                product is selling below cost. We would rather say that than invent something.
              </p>
            </div>
          </Card>
        )}
      </div>

      <SectionTitle
        action={
          <Link
            href="/ledger/"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-text-secondary hover:text-text"
          >
            Ledger
            <ChevronRight className="size-3.5" />
          </Link>
        }
      >
        Where the money went
      </SectionTitle>
      <Card className="mb-7">
        <div className="p-4">
          <RankedBars
            data={mix.slice(0, 6).map((line) => ({
              label: line.category,
              value: line.amount,
              note: `${line.share.toFixed(0)}% of spending${
                line.previous > 0
                  ? ` · ${line.delta >= 0 ? "+" : ""}${line.delta.toFixed(0)}% vs last month`
                  : ""
              }`,
            }))}
          />
        </div>
      </Card>

      <SectionTitle>How this is worked out</SectionTitle>
      <Card>
        <div className="space-y-3.5 p-4">
          <Method
            icon={Calculator}
            title="Arithmetic, not opinion"
            body="Every figure comes from your own ledger, orders and recipes. Each finding shows the numbers behind it so you can check it."
          />
          <Method
            icon={Coins}
            title="To the shilling"
            body="Recipes cost to the gram, deliveries and rider payouts are posted as they happen, and statement imports are matched by transaction code."
          />
          <Method
            icon={CircleAlert}
            title="Silence when there is nothing to say"
            body="If your books are clean, the brief says so. It will not manufacture a worry to look useful."
          />
        </div>
      </Card>
    </>
  );
}

function PanelFigure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-panel-raised px-3 py-2.5">
      <p className="tabular text-[15px] font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-panel-muted">{label}</p>
    </div>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const meta = severityMeta[finding.severity];
  const Icon = meta.icon;

  return (
    <div className="rounded-card border border-border-subtle bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span
          className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", meta.skin)}
        >
          <Icon className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted">
            {meta.label}
          </p>
          <div className="mt-0.5 flex items-baseline justify-between gap-3">
            <p className="text-[15px] font-bold leading-snug">{finding.title}</p>
          </div>
          <p className="tabular mt-1 text-[20px] font-extrabold leading-none">{finding.figure}</p>
        </div>
      </div>

      <p className="mt-3 text-[13px] leading-relaxed text-text-secondary">{finding.body}</p>

      <p className="mt-2.5 rounded-xl bg-surface-sunken px-3 py-2 text-[11px] leading-relaxed text-text-muted">
        <span className="font-semibold">How we got there: </span>
        {finding.workings}
      </p>

      {finding.action && (
        <Link
          href={finding.action.href}
          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-sunken px-3.5 text-[13px] font-semibold text-text transition-colors hover:bg-surface-hover"
        >
          {finding.action.label}
          <ArrowRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}

function Method({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Calculator;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-text-secondary">
        <Icon className="size-4" strokeWidth={2} />
      </span>
      <div>
        <p className="text-[13px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-text-secondary">{body}</p>
      </div>
    </div>
  );
}
