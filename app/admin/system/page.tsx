"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import { AdminFrame, Metric, Panel, PanelHead } from "@/components/admin/admin-frame";
import { Badge } from "@/components/ui/badge";
import { fetchSystem, type PlatformSystem } from "@/lib/admin/api";
import { num } from "@/lib/format";

export default function SystemPage() {
  const [data, setData] = useState<PlatformSystem | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSystem()
      .then(setData)
      .catch((err) => setError((err as Error).message));
  }, []);

  return (
    <AdminFrame
      title="System"
      subtitle="Real signals from the platform database — there is one service, not a fleet, so this is what actually needs watching."
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
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Database"
              value={data.dbOk ? "Reachable" : "Down"}
              sub={`${data.dbLatencyMs} ms round trip`}
            />
            <Metric
              label="Active businesses"
              value={num(data.activeTenants7d)}
              sub="wrote a record in the last 7 days"
            />
            <Metric
              label="Records synced"
              value={num(data.recordsSynced24h)}
              sub="across every business, last 24h"
            />
            <Metric
              label="Unposted M-Pesa events"
              value={num(data.unpostedMpesaEvents)}
              sub="payments Safaricom sent that a human should check"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Panel className="overflow-hidden">
              <PanelHead title="Storefront reports" note="Needing a decision" />
              <div className="flex items-center justify-between px-4 py-4">
                <div className="flex items-center gap-3">
                  <Badge tone={data.openReports > 0 ? "pending" : "success"} dot>
                    {data.openReports > 0 ? "Needs attention" : "Clear"}
                  </Badge>
                  <span className="text-[13px] font-semibold">
                    {data.openReports} open or reviewing
                  </span>
                </div>
                <Link
                  href="/admin/storefronts"
                  className="text-[12px] font-semibold text-brand-text hover:underline"
                >
                  Review
                </Link>
              </div>
            </Panel>

            <Panel className="overflow-hidden">
              <PanelHead title="Support tickets" note="In the queue" />
              <div className="flex items-center justify-between px-4 py-4">
                <div className="flex items-center gap-3">
                  <Badge tone={data.openTickets > 0 ? "pending" : "success"} dot>
                    {data.openTickets > 0 ? "Needs attention" : "Clear"}
                  </Badge>
                  <span className="text-[13px] font-semibold">
                    {data.openTickets} open or pending
                  </span>
                </div>
                <Link
                  href="/admin/support"
                  className="text-[12px] font-semibold text-brand-text hover:underline"
                >
                  Review
                </Link>
              </div>
            </Panel>
          </div>
        </>
      )}
    </AdminFrame>
  );
}
