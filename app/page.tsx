"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bike,
  Boxes,
  Package,
  ScanLine,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader, SectionTitle } from "@/components/ui/page";
import { Hydrated } from "@/components/ui/hydrated";
import { BarChart, StatTile } from "@/components/ui/chart";
import { OrderRow } from "@/components/order-row";
import { EmptyState } from "@/components/ui/state";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import {
  customerOf,
  lowStock,
  revenueSeries,
  smartInsight,
  todayStats,
  unmatchedPayments,
} from "@/lib/selectors";
import { isSameDay, money, pct } from "@/lib/format";

export default function DashboardPage() {
  return (
    <Hydrated>
      <Dashboard />
    </Hydrated>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function Dashboard() {
  const { db } = useStore();
  const stats = todayStats(db);
  const series = revenueSeries(db, 7);
  const insight = smartInsight(db);
  const unmatched = unmatchedPayments(db);
  const short = lowStock(db);

  const todaysOrders = db.orders
    .filter((o) => isSameDay(o.createdAt, new Date()))
    .slice(0, 5);

  const recent = todaysOrders.length ? todaysOrders : db.orders.slice(0, 5);

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${db.business.owner.split(" ")[0]}`}
        subtitle={new Date().toLocaleDateString("en-KE", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      />

      {/* Today's business, the number that matters first. */}
      <Card className="mb-3 overflow-hidden">
        <div className="p-4 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold text-text-secondary">Paid in today</p>
              <p className="tabular mt-1 text-[32px] font-extrabold leading-none tracking-[-0.03em]">
                {money(stats.revenue)}
              </p>
            </div>
            {stats.revenueChange !== 0 && (
              <Badge tone={stats.revenueChange >= 0 ? "success" : "danger"}>
                {stats.revenueChange >= 0 ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {pct(stats.revenueChange)}
              </Badge>
            )}
          </div>
          <p className="mt-1.5 text-[12px] text-text-secondary">
            vs yesterday · {stats.orders} {stats.orders === 1 ? "order" : "orders"} today
          </p>
        </div>
        <div className="px-4 pb-4">
          <BarChart
            data={series.map((d) => ({ label: d.label, value: d.revenue }))}
            height={92}
            hideHeadline
          />
        </div>
      </Card>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Orders" value={String(stats.orders)} sub="placed today" />
        <StatTile
          label="Pending"
          value={String(stats.pending)}
          sub="waiting on you"
          tone={stats.pending > 0 ? "brand" : "default"}
        />
        <StatTile label="Delivered" value={String(stats.delivered)} sub="completed today" />
        <StatTile
          label="Unpaid"
          value={money(stats.unpaid, { compact: true })}
          sub="still to collect"
          tone={stats.unpaid > 0 ? "danger" : "default"}
        />
      </div>

      {/* Quick actions — the six things a seller does all day. */}
      <SectionTitle>Quick actions</SectionTitle>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QuickAction href="/orders/?new=1" icon={Package} label="New order" tone="brand" />
        <QuickAction href="/capture/?new=1" icon={ScanLine} label="Scan receipt" tone="ai" />
        <QuickAction href="/payments/?new=1" icon={Wallet} label="Record payment" tone="success" />
        <QuickAction href="/deliveries" icon={Bike} label="Assign rider" tone="delivery" />
      </div>

      {/* Smart insight — one sentence, always explainable. */}
      <Card className="mb-6 border-transparent bg-ai-soft">
        <div className="flex gap-3 p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ai text-white">
            <Sparkles className="size-[18px]" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-ai-text">
              Smart insight
            </p>
            <p className="mt-1 text-[15px] font-semibold leading-snug">{insight.text}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ai-text/80">{insight.detail}</p>
          </div>
        </div>
      </Card>

      {(unmatched.length > 0 || short.length > 0) && (
        <>
          <SectionTitle>Needs your attention</SectionTitle>
          <div className="mb-6 space-y-2.5">
            {unmatched.length > 0 && (
              <AttentionRow
                href="/payments"
                icon={Wallet}
                title={`${unmatched.length} ${unmatched.length === 1 ? "payment" : "payments"} not matched`}
                body={`${money(unmatched.reduce((s, p) => s + p.amount, 0))} sitting outside your ledger`}
                tone="pending"
              />
            )}
            {short.length > 0 && (
              <AttentionRow
                href="/products"
                icon={Boxes}
                title={`${short.length} ${short.length === 1 ? "product" : "products"} running low`}
                body={short.map((p) => p.name).slice(0, 2).join(", ")}
                tone="danger"
              />
            )}
          </div>
        </>
      )}

      <SectionTitle
        action={
          <Link
            href="/orders"
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand"
          >
            All orders <ArrowRight className="size-3.5" />
          </Link>
        }
      >
        {todaysOrders.length ? "Today's orders" : "Recent orders"}
      </SectionTitle>
      {recent.length ? (
        <div className="space-y-2.5">
          {recent.map((order) => (
            <OrderRow key={order.id} order={order} customer={customerOf(db, order)} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Package className="size-6" />}
          title="No orders yet"
          body="When a conversation turns into a sale, it will show up here."
        />
      )}
    </>
  );
}

const actionTones = {
  brand: "bg-brand-soft text-brand-soft-text",
  ai: "bg-ai-soft text-ai-text",
  success: "bg-success-soft text-success-text",
  delivery: "bg-delivery-soft text-delivery-text",
};

function QuickAction({
  href,
  icon: Icon,
  label,
  tone,
}: {
  href: string;
  icon: typeof Package;
  label: string;
  tone: keyof typeof actionTones;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-start gap-2.5 rounded-card border border-border-subtle bg-surface p-3.5 shadow-card transition-colors hover:bg-surface-hover"
    >
      <span
        className={`flex size-9 items-center justify-center rounded-xl ${actionTones[tone]}`}
      >
        <Icon className="size-[18px]" strokeWidth={2.2} />
      </span>
      <span className="text-[13px] font-semibold leading-tight">{label}</span>
    </Link>
  );
}

function AttentionRow({
  href,
  icon: Icon,
  title,
  body,
  tone,
}: {
  href: string;
  icon: typeof Wallet;
  title: string;
  body: string;
  tone: "pending" | "danger";
}) {
  const tones = {
    pending: "bg-pending-soft text-pending-text",
    danger: "bg-danger-soft text-danger-text",
  };
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-card border border-border-subtle bg-surface p-3.5 shadow-card transition-colors hover:bg-surface-hover"
    >
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
        <Icon className="size-[18px]" strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold">{title}</span>
        <span className="block truncate text-[12px] text-text-secondary">{body}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-text-muted" />
    </Link>
  );
}
