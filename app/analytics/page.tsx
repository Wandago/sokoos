"use client";

import { useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/ui/page";
import { Hydrated } from "@/components/ui/hydrated";
import { Card, CardHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { BarChart, RankedBars, StatTile, TrendChart } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import {
  channelBreakdown,
  ledgerTotals,
  revenueSeries,
  topProducts,
  customerStats,
} from "@/lib/selectors";
import { channelLabel, money, pct } from "@/lib/format";

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
        <StatTile label="Revenue" value={money(revenue, { compact: true })} />
        <StatTile label="Orders" value={String(orders)} />
        <StatTile label="Average order" value={money(aov, { compact: true })} />
        <StatTile
          label="Profit"
          value={money(totals.net, { compact: true })}
          tone={totals.net >= 0 ? "brand" : "danger"}
        />
      </div>

      <Card className="mb-4">
        <CardHeader
          title="Revenue trend"
          action={
            <Badge tone={change >= 0 ? "success" : "danger"}>
              {change >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {pct(change)}
            </Badge>
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
            height={110}
          />
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
