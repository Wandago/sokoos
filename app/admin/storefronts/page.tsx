"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ExternalLink, ShieldAlert, X } from "lucide-react";
import { AdminFrame, Panel } from "@/components/admin/admin-frame";
import { MerchantStatusBadge } from "@/components/admin/merchant-bits";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAdmin } from "@/lib/admin/store";
import { merchantById } from "@/lib/admin/selectors";
import { reasonLabel } from "@/lib/admin/types";
import type { ReportStatus } from "@/lib/admin/types";
import { useQuery } from "@/lib/use-query";
import { fullDate, relativeTime } from "@/lib/format";

export default function StorefrontModerationPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#F4F5F3]" />}>
      <Moderation />
    </Suspense>
  );
}

type Filter = "queue" | ReportStatus;

const statusTone: Record<ReportStatus, "brand" | "pending" | "danger" | "neutral"> = {
  open: "brand",
  reviewing: "pending",
  upheld: "danger",
  dismissed: "neutral",
};

const statusLabel: Record<ReportStatus, string> = {
  open: "Open",
  reviewing: "Reviewing",
  upheld: "Upheld",
  dismissed: "Dismissed",
};

function Moderation() {
  const { db, setReportStatus, setMerchantStatus } = useAdmin();
  const { get, set } = useQuery();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("queue");

  const selected = get("id");

  const counts = useMemo(
    () => ({
      queue: db.reports.filter((r) => r.status === "open" || r.status === "reviewing").length,
      open: db.reports.filter((r) => r.status === "open").length,
      reviewing: db.reports.filter((r) => r.status === "reviewing").length,
      upheld: db.reports.filter((r) => r.status === "upheld").length,
      dismissed: db.reports.filter((r) => r.status === "dismissed").length,
    }),
    [db.reports],
  );

  const rows = db.reports.filter((r) =>
    filter === "queue" ? r.status === "open" || r.status === "reviewing" : r.status === filter,
  );

  return (
    <AdminFrame
      title="Storefront moderation"
      subtitle="Reports raised against merchant mini sites, by customers and by automated scans."
    >
      <Segmented
        className="mb-4"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "queue", label: "Queue", count: counts.queue },
          { value: "open", label: "Open", count: counts.open },
          { value: "reviewing", label: "Reviewing", count: counts.reviewing },
          { value: "upheld", label: "Upheld", count: counts.upheld },
          { value: "dismissed", label: "Dismissed", count: counts.dismissed },
        ]}
      />

      {rows.length === 0 ? (
        <Panel>
          <p className="px-4 py-12 text-center text-[13px] text-[#6B756A]">
            Nothing in this view. The queue is clear.
          </p>
        </Panel>
      ) : (
        <div className="space-y-3">
          {rows.map((report) => {
            const merchant = merchantById(db, report.merchantId);
            const expanded = selected === report.id;
            const settled = report.status === "upheld" || report.status === "dismissed";
            return (
              <Panel key={report.id}>
                <div className="flex flex-wrap items-start gap-3 p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-pending-soft text-pending-text">
                    <ShieldAlert className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14px] font-bold">{reasonLabel[report.reason]}</h3>
                      <Badge tone={statusTone[report.status]} dot>
                        {statusLabel[report.status]}
                      </Badge>
                      <span className="text-[11px] text-[#8A948A]">
                        {report.reporter} · {relativeTime(report.reportedAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-[#4A544A]">
                      {report.detail}
                    </p>
                    {merchant && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px]">
                        <Link
                          href={`/admin/merchants?id=${merchant.id}`}
                          className="font-semibold hover:underline"
                        >
                          {merchant.business}
                        </Link>
                        <MerchantStatusBadge status={merchant.status} />
                        <span className="inline-flex items-center gap-1 text-[#8A948A]">
                          <ExternalLink className="size-3" />
                          sokoos.app/store/{merchant.slug}
                        </span>
                      </div>
                    )}

                    {expanded && merchant && (
                      <div className="mt-3 rounded-xl bg-[#F8F9F7] p-3 text-[12px] leading-relaxed text-[#4A544A]">
                        <p>
                          <span className="font-semibold">Joined:</span>{" "}
                          {fullDate(merchant.joinedAt)} · <span className="font-semibold">Plan:</span>{" "}
                          {merchant.plan} · <span className="font-semibold">Products:</span>{" "}
                          {merchant.products}
                        </p>
                        <p className="mt-1">
                          <span className="font-semibold">Prior reports:</span>{" "}
                          {db.reports.filter((r) => r.merchantId === merchant.id).length - 1}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => set("id", expanded ? null : report.id)}
                    >
                      {expanded ? "Hide" : "Context"}
                    </Button>
                    {!settled && (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setReportStatus(report.id, "dismissed");
                            toast("Report dismissed.");
                          }}
                        >
                          <X className="size-3.5" />
                          Dismiss
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            setReportStatus(report.id, "upheld");
                            if (merchant) {
                              setMerchantStatus(
                                merchant.id,
                                "suspended",
                                `Report upheld: ${reasonLabel[report.reason].toLowerCase()}`,
                              );
                            }
                            toast(
                              merchant
                                ? `Upheld. ${merchant.business} suspended.`
                                : "Report upheld.",
                              "error",
                            );
                          }}
                        >
                          <Check className="size-3.5" strokeWidth={3} />
                          Uphold
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      <p className="mt-5 text-[12px] leading-relaxed text-[#8A948A]">
        Upholding a report suspends the merchant and takes their storefront offline. Their trading
        data is kept, and the account can be reinstated from the merchant record.
      </p>
    </AdminFrame>
  );
}
