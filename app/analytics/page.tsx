"use client";

import { useState } from "react";
import { Boxes, Package, Truck, Wallet } from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/ui/page";
import { Hydrated } from "@/components/ui/hydrated";
import { Card, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { BarChart, GroupedBarChart, RankedBars, TrendChart } from "@/components/ui/chart";
import { StatCard, DeltaPill } from "@/components/ui/stat-card";
import { CardMenu } from "@/components/ui/card-menu";
import { useStore } from "@/lib/store";
import {
  channelBreakdown,
  customerStats,
  ledgerTotals,
  monthOverMonth,
  weeklyIncomeVsSpending,
  revenueSeries,
  topProducts,
} from "@/lib/selectors";
import { channelLabel, money, num } from "@/lib/format";

export default function AnalyticsPage() {
  return (
    <Hydrated>
      <AnalyticsScreen />
    </Hydrated>
  );
}

function AnalyticsScreen() {
  const { db } = useStore();
  const [range, setRange] = useState<"7" | "14" | "30">("14");
  const days = Number(range);

  const series = revenueSeries(db, days);
  const revenue = series.reduce((sum, d) => sum + d.revenue, 0);
  const orders = series.reduce((sum, d) => sum + d.orders, 0);
  const aov = orders ? Math.round(revenue / orders) : 0;

  const half = Math.floor(series.length / 2);
  const firstHalf = series.slice(0, half).reduce((s, d) => s + d.revenue, 0);
  const secondHalf = series.slice(half).reduce((s, d) => s + d.revenue, 0);
  const change = firstHalf ? ((secondHalf - firstHalf) / firstHalf) * 100 : 0;

  const mom = monthOverMonth(db);
  const weekly = weeklyIncomeVsSpending(db, 8);
  const channels = channelBreakdown(db, days);
  const products = topProducts(db, 5);
  const totals = ledgerTotals(db, days);

  const bestCustomers = [...db.customers]
    .map((c) => ({ customer: c, stats: customerStats(db, c.id) }))
    .sort((a, b) => b.stats.spent - a.stats.spent)
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title="Analytics"
        subtitle="Where your money comes from, and what is actually working."
      />

      <Segmented
        className="mb-4"
        value={range}
        onChange={setRange}
        options={[
          { value: "7", label: "7 days" },
          { value: "14", label: "14 days" },
          { value: "30", label: "30 days" },
        ]}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Revenue"
          hint={`Collected across the last ${days} days.`}
          value={money(revenue, { compact: true })}
          icon={Wallet}
          tint={4}
          delta={mom.revenue.delta}
        />
        <StatCard
          label="Orders"
          hint={`Orders placed in the last ${days} days.`}
          value={num(orders)}
          icon={Package}
          tint={1}
          delta={mom.orders.delta}
        />
        <StatCard
          label="Average order"
          hint="Revenue divided by orders in this window."
          value={money(aov, { compact: true })}
          icon={Truck}
          tint={3}
        />
        <StatCard
          label="Spending"
          hint="Stock, rider payouts and running costs."
          value={money(totals.expenses, { compact: true })}
          icon={Boxes}
          tint={2}
          delta={mom.spending.delta}
          invert
        />
      </div>

      <Card className="mb-4">
        <CardHeader
          title="Revenue trend"
          action={
            <span className="flex items-center gap-1.5">
              <DeltaPill delta={change} />
              <CardMenu href="/ledger" label="Open ledger" />
            </span>
          }
        />
        <div className="px-4 pb-4">
          <TrendChart
            data={series.map((d) => ({
              label: d.date.toLocaleDateString("en-KE", { day: "numeric", month: "short" }),
              value: d.revenue,
            }))}
          />
        </div>
      </Card>

      <Card className="mb-4">
        <CardHeader title="Orders per day" />
        <div className="px-4 pb-4">
          <BarChart
            data={series.slice(-7).map((d) => ({ label: d.label, value: d.orders }))}
            valueFormat={(v) => `${v} orders`}
            tickFormat={(v) => String(Math.round(v))}
            height={110}
          />
        </div>
      </Card>

      <Card className="mb-4">
        <CardHeader
          title="Money in vs money out"
          action={<CardMenu href="/ledger" label="Open ledger" />}
        />
        <div className="px-4 pb-4">
          <GroupedBarChart data={weekly} seriesA="Money in" seriesB="Money out" />
        </div>
      </Card>

      <SectionTitle>Where sales come from</SectionTitle>
      <Card className="mb-5 p-4">
        <RankedBars
          data={channels.map((c) => ({
            label: channelLabel[c.channel],
            value: c.revenue,
            note: `${c.orders} ${c.orders === 1 ? "order" : "orders"}`,
          }))}
        />
      </Card>

      <SectionTitle>Best sellers</SectionTitle>
      <Card className="mb-5 p-4">
        <RankedBars
          data={products.map(({ product, qty, revenue }) => ({
            label: product.name,
            value: revenue,
            note: `${qty} sold · ${money(product.price)} each`,
          }))}
        />
      </Card>

      <SectionTitle>Top customers</SectionTitle>
      <Card className="p-4">
        <RankedBars
          data={bestCustomers.map(({ customer, stats }) => ({
            label: customer.name,
            value: stats.spent,
            note: `${stats.orders} orders · ${customer.location}`,
          }))}
        />
      </Card>
    </>
  );
}
