"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { AdminFrame, Metric, Panel, PanelHead } from "@/components/admin/admin-frame";
import { BarChart, RankedBars } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";
import { useAdmin } from "@/lib/admin/store";
import {
  planMix,
  platformStats,
  queueCounts,
  regionBreakdown,
  signupSeries,
  topMerchants,
} from "@/lib/admin/selectors";
import { money, num, relativeTime } from "@/lib/format";
import { MerchantStatusBadge } from "@/components/admin/merchant-bits";

export default function AdminOverviewPage() {
  const { db } = useAdmin();
  const stats = platformStats(db);
  const counts = queueCounts(db);
  const signups = signupSeries(db, 10);
  const regions = regionBreakdown(db);
  const mix = planMix(db);
  const top = topMerchants(db, 6);

  return (
    <AdminFrame
      title="Platform overview"
      subtitle="Everything moving through SokoOS in the last 30 days."
      actions={
        <Link
          href="/admin/merchants"
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-forest-950 px-4 text-[13px] font-semibold text-white"
        >
          All merchants
          <ArrowUpRight className="size-3.5" />
        </Link>
      }
    >
      {/* What needs a human today, before anything else. */}
      {(counts.reports > 0 || counts.breached > 0 || counts.pastDue > 0) && (
        <div className="mb-5 flex flex-wrap gap-2.5">
          {counts.breached > 0 && (
            <QueueChip
              href="/admin/support"
              tone="danger"
              label={`${counts.breached} ${counts.breached === 1 ? "ticket" : "tickets"} past SLA`}
            />
          )}
          {counts.reports > 0 && (
            <QueueChip
              href="/admin/storefronts"
              tone="pending"
              label={`${counts.reports} ${counts.reports === 1 ? "storefront" : "storefronts"} to review`}
            />
          )}
          {counts.pastDue > 0 && (
            <QueueChip
              href="/admin/merchants?status=past_due"
              tone="pending"
              label={`${counts.pastDue} ${counts.pastDue === 1 ? "account" : "accounts"} past due`}
            />
          )}
        </div>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="GMV, last 30 days"
          value={money(stats.gmv, { compact: true })}
          delta={stats.gmvDelta}
          sub="transacted by merchants"
        />
        <Metric
          label="MRR"
          value={money(stats.mrr, { compact: true })}
          sub={`${stats.paying} paying · ${money(stats.arpu)} ARPU`}
        />
        <Metric
          label="Merchants"
          value={num(stats.merchants)}
          sub={`${stats.live} live · ${stats.activeToday} active today`}
        />
        <Metric
          label="Churned"
          value={`${stats.churnRate.toFixed(1)}%`}
          sub={`${stats.churned} of ${stats.merchants} accounts`}
        />
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHead
            title="Sign-ups per week"
            note="New merchants joining the platform"
            action={
              <span className="tabular text-[12px] font-semibold text-[#6B756A]">
                {stats.newThisMonth} in the last 30 days
              </span>
            }
          />
          <div className="p-4">
            <BarChart
              data={signups}
              valueFormat={(v) => `${v} merchants`}
              tickFormat={(v) => String(Math.round(v))}
              height={150}
              integerTicks
              hideHeadline
            />
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Plan mix" note="Where the revenue comes from" />
          <div className="space-y-3.5 p-4">
            {mix.map((row) => (
              <div key={row.plan}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-semibold">{row.label}</span>
                  <span className="tabular text-[13px] font-bold">
                    {money(row.mrr, { compact: true })}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[#F1F2EF]">
                  <div
                    className="h-full rounded-full bg-chart-series"
                    style={{
                      width: `${Math.max(2, (row.count / Math.max(1, db.merchants.length)) * 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-[#8A948A]">{row.count} merchants</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Panel>
          <PanelHead title="GMV by region" note="Last 30 days" />
          <div className="p-4">
            <RankedBars
              data={regions.map((r) => ({
                label: r.region,
                value: r.gmv,
                note: `${r.merchants} merchants`,
              }))}
            />
          </div>
        </Panel>

        <Panel>
          <PanelHead
            title="Top merchants"
            note="By GMV in the last 30 days"
            action={
              <Link
                href="/admin/merchants"
                className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-brand-text"
              >
                See all
                <ChevronRight className="size-3.5" />
              </Link>
            }
          />
          <div className="divide-y divide-[#EDEFEB]">
            {top.map((merchant) => (
              <Link
                key={merchant.id}
                href={`/admin/merchants?id=${merchant.id}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#F8F9F7]"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#F1F2EF] text-[11px] font-bold">
                  {merchant.business.slice(0, 2).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">
                    {merchant.business}
                  </span>
                  <span className="block truncate text-[11px] text-[#8A948A]">
                    {merchant.region} · {merchant.category} · active{" "}
                    {relativeTime(merchant.lastActiveAt).toLowerCase()}
                  </span>
                </span>
                <MerchantStatusBadge status={merchant.status} />
                <span className="tabular w-24 shrink-0 text-right text-[13px] font-bold">
                  {money(merchant.gmv30d, { compact: true })}
                </span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </AdminFrame>
  );
}

function QueueChip({
  href,
  label,
  tone,
}: {
  href: string;
  label: string;
  tone: "danger" | "pending";
}) {
  return (
    <Link href={href}>
      <Badge tone={tone} dot>
        {label}
      </Badge>
    </Link>
  );
}
