"use client";

import Link from "next/link";
import {
  ArrowRight,
  Bike,
  Boxes,
  Package,
  Plus,
  ScanLine,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader, SectionTitle } from "@/components/ui/page";
import { Hydrated } from "@/components/ui/hydrated";
import { BarChart } from "@/components/ui/chart";
import { OrderRow } from "@/components/order-row";
import { BalanceCard } from "@/components/balance-card";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/state";
import { useStore } from "@/lib/store";
import {
  customerOf,
  expenseSeries,
  ledgerTotals,
  lowStock,
  quickSendCustomers,
  revenueSeries,
  smartInsight,
  todayExpenses,
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
  const spending = expenseSeries(db, 7);
  const insight = smartInsight(db);
  const unmatched = unmatchedPayments(db);
  const short = lowStock(db);
  const totals = ledgerTotals(db, 30);
  const spentToday = todayExpenses(db);

  const todaysOrders = db.orders.filter((o) => isSameDay(o.createdAt, new Date())).slice(0, 5);
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

      <BalanceCard
        balance={totals.net}
        businessName={db.business.name}
        tillNumber={db.business.tillNumber}
        caption="Balance, last 30 days"
      />

      {/* The four things a seller reaches for all day. */}
      <div className="my-4 grid grid-cols-4 gap-2.5">
        <ActionTile href="/orders/?new=1" icon={Package} label="Order" />
        <ActionTile href="/payments/?new=1" icon={Wallet} label="Payment" />
        <ActionTile href="/capture/?new=1" icon={ScanLine} label="Scan" />
        <ActionTile href="/deliveries" icon={Bike} label="Rider" />
      </div>

      {/* Earning in lime, spending in forest — the reference pairing. */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-card bg-brand p-4 text-brand-ink">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-bold">Earning</p>
            {stats.revenueChange !== 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-ink/10 px-1.5 py-0.5 text-[10px] font-bold">
                {stats.revenueChange >= 0 ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {pct(stats.revenueChange)}
              </span>
            )}
          </div>
          <p className="tabular mt-2 text-[22px] font-extrabold leading-none tracking-[-0.03em]">
            {money(stats.revenue, { compact: true })}
          </p>
          <p className="mt-1.5 text-[11px] font-medium opacity-70">
            paid in today · {stats.orders} orders
          </p>
        </div>

        <div className="rounded-card bg-panel p-4 text-panel-text">
          <p className="text-[12px] font-bold">Spending</p>
          <p className="tabular mt-2 text-[22px] font-extrabold leading-none tracking-[-0.03em]">
            {money(spentToday, { compact: true })}
          </p>
          <p className="mt-1.5 text-[11px] font-medium text-panel-muted">
            stock, riders and costs today
          </p>
          <div className="mt-3 flex items-end gap-1" aria-hidden>
            {spending.map((day, i) => {
              const max = Math.max(...spending.map((d) => d.value), 1);
              return (
                <span
                  key={i}
                  className={
                    i === spending.length - 1
                      ? "flex-1 rounded-sm bg-brand"
                      : "flex-1 rounded-sm bg-white/20"
                  }
                  style={{ height: Math.max(4, (day.value / max) * 28) }}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-2.5">
        <MiniStat label="Pending" value={String(stats.pending)} accent={stats.pending > 0} />
        <MiniStat label="Delivered" value={String(stats.delivered)} />
        <MiniStat
          label="Unpaid"
          value={money(stats.unpaid, { compact: true })}
          danger={stats.unpaid > 0}
        />
      </div>

      {/* Quick Send */}
      <SectionTitle
        action={
          <Link href="/customers" className="text-[13px] font-semibold text-brand-text">
            See all
          </Link>
        }
      >
        Quick send
      </SectionTitle>
      <div className="no-scrollbar -mx-4 mb-6 flex gap-3.5 overflow-x-auto px-4 pb-1">
        {quickSendCustomers(db).map((customer) => (
          <Link
            key={customer.id}
            href={`/customers/?id=${customer.id}`}
            className="flex w-14 shrink-0 flex-col items-center gap-1.5"
          >
            <Avatar name={customer.name} size="lg" className="size-12 ring-2 ring-surface" />
            <span className="w-full truncate text-center text-[11px] font-medium text-text-secondary">
              {customer.name.split(" ")[0]}
            </span>
          </Link>
        ))}
        <Link href="/orders/?new=1" className="flex w-14 shrink-0 flex-col items-center gap-1.5">
          <span className="flex size-12 items-center justify-center rounded-full border border-dashed border-border-strong text-text-muted">
            <Plus className="size-5" />
          </span>
          <span className="text-[11px] font-medium text-text-secondary">New</span>
        </Link>
      </div>

      {/* Last 7 days */}
      <Card className="mb-5 p-4">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="text-[13px] font-bold">Last 7 days</h2>
          <Link href="/analytics" className="text-[12px] font-semibold text-brand-text">
            Analytics
          </Link>
        </div>
        <BarChart data={series.map((d) => ({ label: d.label, value: d.revenue }))} height={104} />
      </Card>

      {/* Smart insight — one sentence, always explainable. */}
      <Card className="mb-5 border-transparent bg-ai-soft">
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
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand-text"
          >
            See all <ArrowRight className="size-3.5" />
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

function ActionTile({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Package;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-2xl border border-border-subtle bg-surface py-3.5 shadow-card transition-colors hover:bg-surface-hover"
    >
      <Icon className="size-[19px] text-text" strokeWidth={2.1} />
      <span className="text-[11px] font-semibold">{label}</span>
    </Link>
  );
}

function MiniStat({
  label,
  value,
  accent,
  danger,
}: {
  label: string;
  value: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-3 shadow-card">
      <p className="text-[11px] font-semibold text-text-secondary">{label}</p>
      <p
        className={`tabular mt-1 truncate text-[17px] font-bold tracking-[-0.02em] ${
          danger ? "text-danger" : accent ? "text-brand-text" : ""
        }`}
      >
        {value}
      </p>
    </div>
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
