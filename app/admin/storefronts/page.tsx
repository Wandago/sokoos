"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, ExternalLink, Loader2, ShieldAlert, X } from "lucide-react";
import { AdminFrame, Panel } from "@/components/admin/admin-frame";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  fetchReports,
  setReportStatus,
  type AdminReport,
  type ReportReason,
  type ReportStatus,
} from "@/lib/admin/api";
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

const reasonLabel: Record<ReportReason, string> = {
  counterfeit: "Selling fakes or counterfeits",
  scam: "Took payment, never delivered",
  offensive: "Offensive content",
  impersonation: "Impersonating another business",
  other: "Something else",
};

function Moderation() {
  const { get, set } = useQuery();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("queue");
  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const selected = get("id");

  useEffect(() => {
    fetchReports()
      .then(setReports)
      .catch((err) => setError((err as Error).message));
  }, []);

  const counts = useMemo(() => {
    const rows = reports ?? [];
    return {
      queue: rows.filter((r) => r.status === "open" || r.status === "reviewing").length,
      open: rows.filter((r) => r.status === "open").length,
      reviewing: rows.filter((r) => r.status === "reviewing").length,
      upheld: rows.filter((r) => r.status === "upheld").length,
      dismissed: rows.filter((r) => r.status === "dismissed").length,
    };
  }, [reports]);

  const rows = (reports ?? []).filter((r) =>
    filter === "queue" ? r.status === "open" || r.status === "reviewing" : r.status === filter,
  );

  async function act(report: AdminReport, status: "upheld" | "dismissed") {
    setBusy(report.id);
    try {
      const next = await setReportStatus(report.id, status);
      setReports(next);
      toast(
        status === "upheld"
          ? `Upheld. ${report.merchant.name} suspended.`
          : "Report dismissed.",
        status === "upheld" ? "error" : "success",
      );
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminFrame
      title="Storefront moderation"
      subtitle="Reports raised against merchant mini sites, by customers directly from the storefront."
    >
      {error && (
        <p className="mb-4 flex items-center gap-2 rounded-2xl bg-danger-soft p-3.5 text-[13px] font-medium text-danger-text">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </p>
      )}

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

      {!reports ? (
        <p className="flex items-center gap-2 py-12 text-[13px] text-[#6B756A]">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </p>
      ) : rows.length === 0 ? (
        <Panel>
          <p className="px-4 py-12 text-center text-[13px] text-[#6B756A]">
            Nothing in this view. The queue is clear.
          </p>
        </Panel>
      ) : (
        <div className="space-y-3">
          {rows.map((report) => {
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
                        {report.reporterContact || "Anonymous"} · {relativeTime(report.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-[#4A544A]">
                      {report.detail}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px]">
                      <Link
                        href={`/admin/merchants?id=${report.merchant.id}`}
                        className="font-semibold hover:underline"
                      >
                        {report.merchant.name}
                      </Link>
                      <span className="inline-flex items-center gap-1 text-[#8A948A]">
                        <ExternalLink className="size-3" />
                        sokoos.app/store/{report.merchant.slug}
                      </span>
                    </div>

                    {expanded && (
                      <div className="mt-3 rounded-xl bg-[#F8F9F7] p-3 text-[12px] leading-relaxed text-[#4A544A]">
                        <p>
                          <span className="font-semibold">Filed:</span> {fullDate(report.createdAt)}
                          {report.resolvedAt && (
                            <>
                              {" "}
                              · <span className="font-semibold">Resolved:</span>{" "}
                              {fullDate(report.resolvedAt)} by {report.resolvedBy}
                            </>
                          )}
                        </p>
                        <p className="mt-1">
                          <span className="font-semibold">Prior reports on this business:</span>{" "}
                          {report.priorReports}
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
                          disabled={busy === report.id}
                          onClick={() => act(report, "dismissed")}
                        >
                          <X className="size-3.5" />
                          Dismiss
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={busy === report.id}
                          onClick={() => act(report, "upheld")}
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
