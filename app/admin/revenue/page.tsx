"use client";

import { AdminFrame, Metric, Panel, PanelHead } from "@/components/admin/admin-frame";
import { GroupedBarChart, RankedBars } from "@/components/ui/chart";
import { PlanBadge, MerchantStatusBadge } from "@/components/admin/merchant-bits";
import { useAdmin } from "@/lib/admin/store";
import { planMix, platformStats } from "@/lib/admin/selectors";
import { money, num, relativeTime } from "@/lib/format";
import Link from "next/link";

export default function RevenuePage() {
  const { db } = useAdmin();
  const stats = platformStats(db);
  const mix = planMix(db);

  // MRR against GMV, month by month, reconstructed from when each merchant
  // joined — an honest approximation, not a billing ledger.
  const months = Array.from({ length: 6 }, (_, i) => {
    const start = new Date();
    start.setMonth(start.getMonth() - (5 - i), 1);
    start.setHours(0, 0, 0, 0);
    const joined = db.merchants.filter((m) => +new Date(m.joinedAt) <= +start);
    const paying = joined.filter((m) => m.mrr > 0);
    return {
      label: start.toLocaleDateString("en-KE", { month: "short" }),
      a: paying.reduce((sum, m) => sum + m.mrr, 0),
      b: Math.round(joined.reduce((sum, m) => sum + m.gmv30d, 0) / 100),
    };
  });

  const pastDue = db.merchants.filter((m) => m.status === "past_due");

  return (
    <AdminFrame
      title="Revenue"
      subtitle="What SokoOS earns, against what merchants transact."
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="MRR" value={money(stats.mrr, { compact: true })} sub="recurring, this month" />
        <Metric label="ARPU" value={money(stats.arpu)} sub={`${stats.paying} paying merchants`} />
        <Metric
          label="Take rate"
          value={`${stats.takeRate.toFixed(2)}%`}
          sub="MRR as a share of GMV"
        />
        <Metric
          label="Past due"
          value={num(pastDue.length)}
          sub={money(pastDue.reduce((sum, m) => sum + m.mrr, 0)) + " at risk"}
        />
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel>
          <PanelHead
            title="MRR against GMV"
            note="GMV shown at 1% scale so both series share one axis"
          />
          <div className="p-4">
            <GroupedBarChart data={months} seriesA="MRR" seriesB="GMV ÷ 100" />
          </div>
        </Panel>

        <Panel>
          <PanelHead title="Revenue by plan" />
          <div className="p-4">
            <RankedBars
              data={mix.map((row) => ({
                label: row.label,
                value: row.mrr,
                note: `${row.count} merchants · ${
                  stats.mrr ? Math.round((row.mrr / stats.mrr) * 100) : 0
                }% of MRR`,
              }))}
            />
          </div>
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <PanelHead
          title="Accounts past due"
          note="Chase these before they churn"
          action={
            <span className="tabular text-[12px] font-semibold text-[#6B756A]">
              {money(pastDue.reduce((sum, m) => sum + m.mrr, 0))} at risk
            </span>
          }
        />
        {pastDue.length ? (
          <div className="divide-y divide-[#EDEFEB]">
            {pastDue.map((merchant) => (
              <Link
                key={merchant.id}
                href={`/admin/merchants?id=${merchant.id}`}
                className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-[#F8F9F7]"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">
                    {merchant.business}
                  </span>
                  <span className="block truncate text-[11px] text-[#8A948A]">
                    {merchant.owner} · last active {relativeTime(merchant.lastActiveAt).toLowerCase()}
                  </span>
                </span>
                <PlanBadge plan={merchant.plan} />
                <MerchantStatusBadge status={merchant.status} />
                <span className="tabular w-24 shrink-0 text-right text-[13px] font-bold">
                  {money(merchant.mrr)}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="px-4 py-10 text-center text-[13px] text-[#6B756A]">
            Nothing past due. Every paying account is current.
          </p>
        )}
      </Panel>
    </AdminFrame>
  );
}
