"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Search, ShieldAlert } from "lucide-react";
import { AdminFrame, Panel, PanelHead } from "@/components/admin/admin-frame";
import { MerchantStatusBadge, PlanBadge } from "@/components/admin/merchant-bits";
import { Segmented } from "@/components/ui/segmented";
import { Sheet, ConfirmSheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAdmin } from "@/lib/admin/store";
import { merchantById } from "@/lib/admin/selectors";
import { planLabel, planPrice } from "@/lib/admin/types";
import type { MerchantStatus, Plan } from "@/lib/admin/types";
import { useQuery } from "@/lib/use-query";
import { fullDate, money, num, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

export default function MerchantsPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#F4F5F3]" />}>
      <Merchants />
    </Suspense>
  );
}

type Filter = "all" | MerchantStatus;

function Merchants() {
  const { db } = useAdmin();
  const { get, set } = useQuery();
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(25);

  const filter = (get("status") as Filter) ?? "all";
  const open = get("id") ? merchantById(db, get("id") as string) : undefined;

  const counts = useMemo(
    () => ({
      all: db.merchants.length,
      active: db.merchants.filter((m) => m.status === "active").length,
      trial: db.merchants.filter((m) => m.status === "trial").length,
      past_due: db.merchants.filter((m) => m.status === "past_due").length,
      suspended: db.merchants.filter((m) => m.status === "suspended").length,
      churned: db.merchants.filter((m) => m.status === "churned").length,
    }),
    [db.merchants],
  );

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return db.merchants
      .filter((m) => (filter === "all" ? true : m.status === filter))
      .filter((m) =>
        query
          ? m.business.toLowerCase().includes(query) ||
            m.owner.toLowerCase().includes(query) ||
            m.email.toLowerCase().includes(query) ||
            m.region.toLowerCase().includes(query)
          : true,
      )
      .sort((a, b) => b.gmv30d - a.gmv30d);
  }, [db.merchants, filter, search]);

  return (
    <AdminFrame
      title="Merchants"
      subtitle={`${num(counts.all)} accounts on the platform.`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="relative flex-1 lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8A948A]" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisible(25);
            }}
            placeholder="Search business, owner, email or region"
            className="h-10 w-full rounded-full border border-[#E2E5DF] bg-white pl-10 pr-4 text-[13px] focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
          />
        </span>
        <Segmented
          value={filter}
          onChange={(next) => {
            set("status", next === "all" ? null : next);
            setVisible(25);
          }}
          options={[
            { value: "all", label: "All", count: counts.all },
            { value: "active", label: "Active", count: counts.active },
            { value: "trial", label: "Trial", count: counts.trial },
            { value: "past_due", label: "Past due", count: counts.past_due },
            { value: "suspended", label: "Suspended", count: counts.suspended },
            { value: "churned", label: "Churned", count: counts.churned },
          ]}
        />
      </div>

      <Panel className="overflow-hidden">
        <PanelHead
          title={`${num(rows.length)} merchants`}
          note="Sorted by GMV over the last 30 days"
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[#EDEFEB] text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A948A]">
                <th className="px-4 py-2.5">Business</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Plan</th>
                <th className="px-4 py-2.5 text-right">GMV 30d</th>
                <th className="px-4 py-2.5 text-right">Orders</th>
                <th className="px-4 py-2.5 text-right">MRR</th>
                <th className="px-4 py-2.5">Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDEFEB]">
              {rows.slice(0, visible).map((merchant) => (
                <tr
                  key={merchant.id}
                  onClick={() => set("id", merchant.id)}
                  className="cursor-pointer transition-colors hover:bg-[#F8F9F7]"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#F1F2EF] text-[11px] font-bold">
                        {merchant.business.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold">
                          {merchant.business}
                        </span>
                        <span className="block truncate text-[11px] text-[#8A948A]">
                          {merchant.owner} · {merchant.region}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <MerchantStatusBadge status={merchant.status} />
                  </td>
                  <td className="px-4 py-3">
                    <PlanBadge plan={merchant.plan} />
                  </td>
                  <td className="tabular px-4 py-3 text-right text-[13px] font-semibold">
                    {merchant.gmv30d ? money(merchant.gmv30d, { compact: true }) : "—"}
                  </td>
                  <td className="tabular px-4 py-3 text-right text-[13px]">
                    {merchant.orders30d || "—"}
                  </td>
                  <td className="tabular px-4 py-3 text-right text-[13px]">
                    {merchant.mrr ? money(merchant.mrr) : "—"}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-[#6B756A]">
                    {relativeTime(merchant.lastActiveAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visible < rows.length && (
          <button
            onClick={() => setVisible((v) => v + 25)}
            className="w-full border-t border-[#EDEFEB] py-3 text-[13px] font-semibold text-[#6B756A] transition-colors hover:bg-[#F8F9F7]"
          >
            Show 25 more · {rows.length - visible} left
          </button>
        )}
        {rows.length === 0 && (
          <p className="px-4 py-10 text-center text-[13px] text-[#6B756A]">
            No merchant matches that search.
          </p>
        )}
      </Panel>

      {open && <MerchantPanel id={open.id} onClose={() => set("id", null)} />}
    </AdminFrame>
  );
}

function MerchantPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { db, setMerchantPlan, setMerchantStatus } = useAdmin();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);

  const merchant = merchantById(db, id);
  if (!merchant) return null;

  const reports = db.reports.filter((r) => r.merchantId === id);
  const tickets = db.tickets.filter((t) => t.merchantId === id);
  const suspended = merchant.status === "suspended";

  return (
    <Sheet
      open
      onClose={onClose}
      title={merchant.business}
      description={`${merchant.owner} · ${merchant.region} · joined ${fullDate(merchant.joinedAt)}`}
      size="lg"
      footer={
        <div className="flex flex-wrap gap-2.5">
          <Button
            variant={suspended ? "secondary" : "danger"}
            onClick={() => {
              if (suspended) {
                setMerchantStatus(merchant.id, "active");
                toast(`${merchant.business} reinstated.`);
              } else {
                setConfirming(true);
              }
            }}
          >
            <ShieldAlert className="size-4" />
            {suspended ? "Reinstate account" : "Suspend account"}
          </Button>
          <Button variant="secondary" full>
            <ExternalLink className="size-4" />
            Open their storefront
          </Button>
        </div>
      }
    >
      <div className="space-y-5 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <MerchantStatusBadge status={merchant.status} />
          <PlanBadge plan={merchant.plan} />
          {merchant.storefrontPublished ? (
            <span className="text-[12px] text-[#6B756A]">
              sokoos.app/store/{merchant.slug}
            </span>
          ) : (
            <span className="text-[12px] text-[#8A948A]">Storefront unpublished</span>
          )}
        </div>

        {merchant.suspendedReason && (
          <p className="rounded-2xl bg-danger-soft p-3.5 text-[13px] leading-relaxed text-danger-text">
            Suspended: {merchant.suspendedReason}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="GMV 30d" value={money(merchant.gmv30d, { compact: true })} />
          <Stat label="Orders 30d" value={num(merchant.orders30d)} />
          <Stat label="MRR" value={merchant.mrr ? money(merchant.mrr) : "—"} />
          <Stat label="Products" value={num(merchant.products)} />
        </div>

        <div>
          <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-[#8A948A]">
            Plan
          </p>
          <div className="flex flex-wrap gap-2">
            {(["starter", "growth", "scale"] as Plan[]).map((plan) => (
              <button
                key={plan}
                onClick={() => {
                  setMerchantPlan(merchant.id, plan);
                  toast(`Moved to ${planLabel[plan]}.`);
                }}
                className={cn(
                  "rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors",
                  merchant.plan === plan
                    ? "border-transparent bg-brand text-brand-ink"
                    : "border-border bg-surface hover:bg-surface-hover",
                )}
              >
                {planLabel[plan]}
                <span className="tabular ml-1.5 opacity-60">
                  {planPrice[plan] ? money(planPrice[plan]) : "Free"}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-[#8A948A]">
            Contact
          </p>
          <div className="space-y-1.5 rounded-2xl bg-surface-sunken p-3.5 text-[13px]">
            <p>{merchant.email}</p>
            <p className="tabular">{merchant.phone}</p>
          </div>
        </div>

        {(reports.length > 0 || tickets.length > 0) && (
          <div>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-[#8A948A]">
              History
            </p>
            <div className="space-y-2">
              {reports.map((report) => (
                <Link
                  key={report.id}
                  href={`/admin/storefronts?id=${report.id}`}
                  className="block rounded-xl border border-border-subtle p-3 text-[13px] transition-colors hover:bg-surface-hover"
                >
                  <span className="font-semibold">Report · {report.reason.replace("_", " ")}</span>
                  <span className="ml-2 text-[12px] text-[#8A948A]">
                    {relativeTime(report.reportedAt)}
                  </span>
                </Link>
              ))}
              {tickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/admin/support?id=${ticket.id}`}
                  className="block rounded-xl border border-border-subtle p-3 text-[13px] transition-colors hover:bg-surface-hover"
                >
                  <span className="font-semibold">{ticket.subject}</span>
                  <span className="ml-2 text-[12px] text-[#8A948A]">
                    {relativeTime(ticket.openedAt)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmSheet
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setMerchantStatus(merchant.id, "suspended", "Suspended by an operator");
          toast(`${merchant.business} suspended.`, "error");
        }}
        title={`Suspend ${merchant.business}?`}
        body="Their storefront goes offline and they cannot take new orders. Their data is kept, and you can reinstate the account at any time."
        confirmLabel="Suspend"
        tone="danger"
      />
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border-subtle p-3">
      <p className="text-[11px] font-semibold text-[#8A948A]">{label}</p>
      <p className="tabular mt-1 text-[16px] font-bold">{value}</p>
    </div>
  );
}
