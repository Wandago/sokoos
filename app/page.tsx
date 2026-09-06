"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bike,
  Boxes,
  ChevronRight,
  Package,
  Plus,
  ScanLine,
  Sparkles,
  Truck,
  Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionTitle } from "@/components/ui/page";
import { Hydrated } from "@/components/ui/hydrated";
import { BarChart, GoalMeter } from "@/components/ui/chart";
import { StatCard, DeltaPill } from "@/components/ui/stat-card";
import { CardMenu } from "@/components/ui/card-menu";
import { OrderRow } from "@/components/order-row";
import { BalanceCard } from "@/components/balance-card";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState, ListSkeleton } from "@/components/ui/state";
import { useTour } from "@/components/product-tour";
import { useStore } from "@/lib/store";
import { TOURED_KEY, appTourSteps } from "@/lib/tour";
import {
  customerOf,
  expenseSeries,
  ledgerTotals,
  lowStock,
  monthOverMonth,
  quickSendCustomers,
  revenueSeries,
  smartInsight,
  todayExpenses,
  todayStats,
  unmatchedPayments,
} from "@/lib/selectors";
import { bookingsOn } from "@/lib/services";
import { goodsTotal } from "@/lib/selectors";
import { clockTime, isSameDay, money, num } from "@/lib/format";

export default function DashboardPage() {
  return (
    <Hydrated>
      <FirstRunGate>
        <Dashboard />
      </FirstRunGate>
    </Hydrated>
  );
}

/**
 * The tour now lives after signup, not before it — see app/welcome/page.tsx.
 * All this gate does is keep a stranger's numbers off a device with no
 * account on it.
 */
function FirstRunGate({ children }: { children: React.ReactNode }) {
  const { db } = useStore();
  const router = useRouter();
  const destination = !db.account ? "/login" : null;

  useEffect(() => {
    if (destination) router.replace(destination);
  }, [destination, router]);

  if (destination) return <ListSkeleton rows={4} />;
  return <>{children}</>;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function Dashboard() {
  const { db } = useStore();
  const tour = useTour();

  // The one moment this fires on its own: the first time the dashboard a
  // new account actually owns is the screen in front of them, not a demo.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(TOURED_KEY) === "1") return;
      window.localStorage.setItem(TOURED_KEY, "1");
    } catch {
      return;
    }
    tour.start(appTourSteps);
    // Runs once per mount; re-triggering on every store update would restart
    // the tour mid-sale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = todayStats(db);
  const mom = monthOverMonth(db);
  const series = revenueSeries(db, 7);
  const spending = expenseSeries(db, 7);
  const insight = smartInsight(db);
  const unmatched = unmatchedPayments(db);
  const short = lowStock(db);
  const totals = ledgerTotals(db, 30);
  const spentToday = todayExpenses(db);
  // The next job still to happen today, if this business has a diary at all.
  const nextUp = bookingsOn(db, new Date()).find(
    (order) => order.booking.state === "booked" || order.booking.state === "in_progress",
  );

  // A weekly target from the business's own run rate, nudged up 10%.
  const weekEarned = series.reduce((sum, d) => sum + d.revenue, 0);
  const weeklyGoal = Math.max(
    Math.round(((mom.revenue.value / 30) * 7 * 1.1) / 1000) * 1000,
    1000,
  );

  // The card is headed "This week", so the delta must be week on week.
  const fortnight = revenueSeries(db, 14);
  const lastWeek = fortnight.slice(0, 7).reduce((sum, d) => sum + d.revenue, 0);
  const weekDelta = lastWeek > 0 ? ((weekEarned - lastWeek) / lastWeek) * 100 : 0;

  const todaysOrders = db.orders.filter((o) => isSameDay(o.createdAt, new Date())).slice(0, 4);
  const recent = todaysOrders.length ? todaysOrders : db.orders.slice(0, 4);

  return (
    <>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-text-secondary">{greeting()},</p>
          <h1 className="truncate text-[24px] font-extrabold leading-tight tracking-[-0.03em]">
            {db.business.owner}
          </h1>
        </div>
        <Link
          href="/orders/?new=1"
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-panel px-4 text-[13px] font-semibold text-panel-text"
        >
          <Plus className="size-4" strokeWidth={2.6} />
          New order
        </Link>
      </div>

      <BalanceCard
        balance={totals.net}
        businessName={db.business.name}
        tillNumber={db.business.tillNumber}
        caption="Balance, last 30 days"
        delta={mom.revenue.delta}
      />

      {/* The four things a seller reaches for all day. */}
      <div className="my-4 grid grid-cols-4 gap-2.5">
        <ActionTile href="/orders/?new=1" icon={Package} label="Order" accent />
        <ActionTile href="/payments/?new=1" icon={Wallet} label="Payment" />
        <ActionTile href="/capture/?new=1" icon={ScanLine} label="Scan" />
        <ActionTile href="/deliveries" icon={Bike} label="Rider" />
      </div>

      {/* Month-on-month metrics, the shape every reference dashboard uses. */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <StatCard
          label="Revenue"
          hint="Money collected on paid and delivered orders in the last 30 days."
          value={money(mom.revenue.value, { compact: true })}
          icon={Wallet}
          tint={4}
          change={`${mom.revenue.change >= 0 ? "+" : "−"}${money(Math.abs(mom.revenue.change), { compact: true, bare: true })}`}
          delta={mom.revenue.delta}
        />
        <StatCard
          label="Orders"
          hint="Orders placed in the last 30 days, excluding cancellations."
          value={num(mom.orders.value)}
          icon={Package}
          tint={1}
          change={`${mom.orders.change >= 0 ? "+" : "−"}${num(Math.abs(mom.orders.change))}`}
          delta={mom.orders.delta}
        />
        <StatCard
          label="Delivered"
          hint="Orders that reached the customer in the last 30 days."
          value={num(mom.delivered.value)}
          icon={Truck}
          tint={3}
          change={`${mom.delivered.change >= 0 ? "+" : "−"}${num(Math.abs(mom.delivered.change))}`}
          delta={mom.delivered.delta}
        />
        <StatCard
          label="Spending"
          hint="Stock, rider payouts and running costs in the last 30 days."
          value={money(mom.spending.value, { compact: true })}
          icon={Boxes}
          tint={2}
          change={`${mom.spending.change >= 0 ? "+" : "−"}${money(Math.abs(mom.spending.change), { compact: true, bare: true })}`}
          delta={mom.spending.delta}
          invert
        />
      </div>

      {/* Earning in lime, spending in forest — the reference pairing. */}
      <div className="mb-5 grid grid-cols-2 gap-3">
        <div className="rounded-card bg-brand p-4 text-brand-ink">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-bold">Earning</p>
            <CardMenu href="/analytics" label="Open analytics" />
          </div>
          <p className="tabular mt-1.5 text-[22px] font-extrabold leading-none tracking-[-0.03em]">
            {money(stats.revenue, { compact: true })}
          </p>
          <p className="mt-1.5 text-[11px] font-medium opacity-70">
            paid in today · {stats.orders} orders
          </p>
          <GoalMeter current={weekEarned} target={weeklyGoal} className="mt-4" />
        </div>

        <div className="rounded-card bg-panel p-4 text-panel-text">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-bold">Spending</p>
            <CardMenu href="/ledger" label="Open ledger" />
          </div>
          <p className="tabular mt-1.5 text-[22px] font-extrabold leading-none tracking-[-0.03em]">
            {money(spentToday, { compact: true })}
          </p>
          <p className="mt-1.5 text-[11px] font-medium text-panel-muted">stock, riders and costs</p>
          <div className="mt-4 flex h-[26px] items-end gap-1" aria-hidden>
            {spending.map((day, i) => {
              const max = Math.max(...spending.map((d) => d.value), 1);
              return (
                <span
                  key={i}
                  className={
                    i === spending.length - 1
                      ? "flex-1 rounded-t-[3px] bg-brand"
                      : "flex-1 rounded-t-[3px] bg-white/20"
                  }
                  style={{ height: Math.max(3, (day.value / max) * 26) }}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Quick Send */}
      <SectionTitle action={<SeeAll href="/customers" />}>Quick send</SectionTitle>
      <div className="no-scrollbar -mx-4 mb-6 flex gap-3.5 overflow-x-auto px-4 pb-1">
        {quickSendCustomers(db).map((customer) => (
          <Link
            key={customer.id}
            href={`/customers/?id=${customer.id}`}
            className="flex w-14 shrink-0 flex-col items-center gap-1.5"
          >
            <span className="rounded-full p-0.5 ring-2 ring-brand">
              <Avatar name={customer.name} className="size-11" />
            </span>
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
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[14px] font-bold">This week</h2>
            <p className="mt-0.5 text-[11px] text-text-secondary">Collected per day</p>
          </div>
          <div className="flex items-center gap-1.5">
            <DeltaPill delta={weekDelta} />
            <CardMenu href="/analytics" label="Open analytics" />
          </div>
        </div>
        <BarChart
          data={series.map((d) => ({ label: d.label, value: d.revenue }))}
          height={112}
          hideHeadline
        />
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
            <Link
              href="/cfo/"
              className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-bold text-ai-text hover:underline"
            >
              Read the full brief
              <ChevronRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </Card>

      {/* A service business's next question is not "what sold" but "who is
          coming in, and when". Only shown when there is actually a diary. */}
      {nextUp && (
        <>
          <SectionTitle
            action={
              <Link
                href="/bookings/"
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-text-secondary hover:text-text"
              >
                Diary
                <ChevronRight className="size-3.5" />
              </Link>
            }
          >
            Next in the diary
          </SectionTitle>
          <Link
            href={`/bookings/?id=${nextUp.id}`}
            className="mb-6 flex items-center gap-3 rounded-card border border-border-subtle bg-surface p-3.5 shadow-card transition-colors hover:bg-surface-hover"
          >
            <div className="w-14 shrink-0 text-center">
              <p className="tabular text-[15px] font-extrabold leading-none">
                {clockTime(nextUp.booking!.startsAt)}
              </p>
              <p className="mt-1 text-[11px] text-text-muted">{nextUp.booking!.durationMinutes}m</p>
            </div>
            <div className="min-w-0 flex-1 border-l border-border-subtle pl-3">
              <p className="truncate text-[15px] font-semibold">
                {db.services.find((sv) => sv.id === nextUp.booking!.serviceId)?.name}
              </p>
              <p className="mt-0.5 truncate text-[12px] text-text-secondary">
                {db.customers.find((c) => c.id === nextUp.customerId)?.name}
                {nextUp.booking!.staffId
                  ? ` · ${db.staff.find((p) => p.id === nextUp.booking!.staffId)?.name}`
                  : ""}
              </p>
            </div>
            <p className="tabular shrink-0 text-[15px] font-bold">{money(goodsTotal(nextUp))}</p>
          </Link>
        </>
      )}

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

      <SectionTitle action={<SeeAll href="/orders" />}>
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

function SeeAll({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-0.5 text-[13px] font-semibold text-brand-text"
    >
      See all
      <ChevronRight className="size-3.5" />
    </Link>
  );
}

function ActionTile({
  href,
  icon: Icon,
  label,
  accent,
}: {
  href: string;
  icon: typeof Package;
  label: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        accent
          ? "flex flex-col items-center gap-2 rounded-2xl bg-brand py-3.5 text-brand-ink shadow-card transition-[filter] hover:brightness-95"
          : "flex flex-col items-center gap-2 rounded-2xl border border-border-subtle bg-surface py-3.5 shadow-card transition-colors hover:bg-surface-hover"
      }
    >
      <Icon className="size-[19px]" strokeWidth={2.1} />
      <span className="text-[11px] font-semibold">{label}</span>
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
