"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import { AdminFrame, Metric, Panel, PanelHead } from "@/components/admin/admin-frame";
import { BarChart, RankedBars } from "@/components/ui/chart";
import { fetchRevenue, type PlatformRevenue } from "@/lib/admin/api";
import { money } from "@/lib/format";

export default function RevenuePage() {
  const [data, setData] = useState<PlatformRevenue | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchRevenue()
      .then(setData)
      .catch((err) => setError((err as Error).message));
  }, []);

  return (
    <AdminFrame
      title="Revenue"
      subtitle="What actually moved through the platform. There is no billing yet, so this is transaction volume, not what SokoOS earns."
    >
      {error && (
        <p className="mb-4 flex items-center gap-2 rounded-2xl bg-danger-soft p-3.5 text-[13px] font-medium text-danger-text">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </p>
      )}

      {!data ? (
        <p className="flex items-center gap-2 py-12 text-[13px] text-[#6B756A]">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </p>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            <Metric
              label="GMV this month"
              value={money(data.gmvThisMonth, { compact: true })}
              sub="payments recorded as received, calendar month to date"
            />
            <Metric
              label="GMV, last 30 days"
              value={money(data.gmvLast30d, { compact: true })}
              sub="M-Pesa, cash — however it was recorded"
            />
          </div>

          <div className="mb-5 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Panel>
              <PanelHead title="GMV by week" note="Last 8 weeks, across every business" />
              <div className="p-4">
                {data.gmvByWeek.length ? (
                  <BarChart
                    data={data.gmvByWeek.map((w) => ({
                      label: new Date(w.label).toLocaleDateString("en-KE", {
                        month: "short",
                        day: "numeric",
                      }),
                      value: w.value,
                    }))}
                  />
                ) : (
                  <p className="py-8 text-center text-[13px] text-[#6B756A]">
                    No payments recorded yet.
                  </p>
                )}
              </div>
            </Panel>

            <Panel>
              <PanelHead title="Top merchants" note="By GMV in the last 30 days" />
              <div className="p-4">
                {data.topMerchants.length ? (
                  <RankedBars
                    data={data.topMerchants.map((m) => ({
                      label: m.name,
                      value: m.gmv,
                      note: `sokoos.app/store/${m.slug}`,
                    }))}
                  />
                ) : (
                  <p className="py-8 text-center text-[13px] text-[#6B756A]">
                    Nothing in the last 30 days.
                  </p>
                )}
              </div>
            </Panel>
          </div>

          {data.topMerchants.length > 0 && (
            <Panel className="overflow-hidden">
              <PanelHead title="Top merchants, in detail" note="Last 30 days" />
              <div className="divide-y divide-[#EDEFEB]">
                {data.topMerchants.map((merchant) => (
                  <Link
                    key={merchant.id}
                    href={`/admin/merchants?id=${merchant.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#F8F9F7]"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                      {merchant.name}
                    </span>
                    <span className="tabular w-28 shrink-0 text-right text-[13px] font-bold">
                      {money(merchant.gmv)}
                    </span>
                  </Link>
                ))}
              </div>
            </Panel>
          )}
        </>
      )}
    </AdminFrame>
  );
}
