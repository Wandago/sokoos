"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Search, ShieldAlert } from "lucide-react";
import { AdminFrame, Panel, PanelHead } from "@/components/admin/admin-frame";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { Sheet, ConfirmSheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  adminApiAvailable,
  fetchMerchant,
  fetchMerchants,
  reinstateMerchant,
  suspendMerchant,
  type AdminMerchant,
  type MerchantDetail as MerchantDetailData,
} from "@/lib/admin/api";
import { useQuery } from "@/lib/use-query";
import { fullDate, num, relativeTime } from "@/lib/format";

/**
 * The one page in this console wired to the real platform database — every
 * other admin screen still shows sample data, which is why the login page
 * says so. A tenant here is a business someone actually signed up, suspending
 * one actually locks them out (see server/src/index.ts: a suspended tenant
 * disappears from its own owner's session), and every action is written to
 * `admin_audit`, not to a localStorage flag.
 */

type Filter = "all" | "active" | "suspended";

export default function MerchantsPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#F4F5F3]" />}>
      <Merchants />
    </Suspense>
  );
}

function Merchants() {
  const { get, set } = useQuery();
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(25);
  const [merchants, setMerchants] = useState<AdminMerchant[] | null>(null);
  const [error, setError] = useState("");

  const filter = (get("status") as Filter) ?? "all";
  const openId = get("id");

  const load = () => {
    fetchMerchants()
      .then((list) => {
        setMerchants(list);
        setError("");
      })
      .catch((err) => setError((err as Error).message));
  };

  useEffect(load, []);

  const counts = useMemo(() => {
    const list = merchants ?? [];
    return {
      all: list.length,
      active: list.filter((m) => !m.suspendedAt).length,
      suspended: list.filter((m) => m.suspendedAt).length,
    };
  }, [merchants]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (merchants ?? [])
      .filter((m) => (filter === "all" ? true : filter === "suspended" ? m.suspendedAt : !m.suspendedAt))
      .filter((m) =>
        query
          ? m.name.toLowerCase().includes(query) ||
            m.owner?.name.toLowerCase().includes(query) ||
            m.owner?.phone.includes(query) ||
            m.slug.toLowerCase().includes(query)
          : true,
      );
  }, [merchants, filter, search]);

  if (!adminApiAvailable()) {
    return (
      <AdminFrame title="Merchants" subtitle="No API configured for this build.">
        <Panel className="p-6 text-[13px] leading-relaxed text-[#6B756A]">
          Set <code>NEXT_PUBLIC_API_URL</code> and redeploy to see real merchants here.
        </Panel>
      </AdminFrame>
    );
  }

  return (
    <AdminFrame title="Merchants" subtitle={`${num(counts.all)} businesses on the platform.`}>
      {error && (
        <p className="mb-4 flex items-center gap-2 rounded-2xl bg-danger-soft p-3.5 text-[13px] font-medium text-danger-text">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="relative flex-1 lg:max-w-sm">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#8A948A]" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisible(25);
            }}
            placeholder="Search business, owner or address"
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
            { value: "suspended", label: "Suspended", count: counts.suspended },
          ]}
        />
      </div>

      <Panel className="overflow-hidden">
        <PanelHead title={`${num(rows.length)} merchants`} note="Newest first" />
        {merchants === null && !error ? (
          <p className="flex items-center justify-center gap-2 px-4 py-10 text-[13px] text-[#6B756A]">
            <Loader2 className="size-4 animate-spin" />
            Loading merchants…
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#EDEFEB] text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A948A]">
                  <th className="px-4 py-2.5">Business</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Till</th>
                  <th className="px-4 py-2.5">Joined</th>
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
                          {merchant.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-semibold">
                            {merchant.name}
                          </span>
                          <span className="block truncate text-[11px] text-[#8A948A]">
                            {merchant.owner?.name ?? "No owner on record"} · {merchant.slug}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={merchant.suspendedAt ? "danger" : "success"} dot>
                        {merchant.suspendedAt ? "Suspended" : "Active"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#6B756A]">
                      {merchant.till
                        ? merchant.till.registeredAt
                          ? "Connected"
                          : "Connected, not registered"
                        : "Not connected"}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#6B756A]">
                      {fullDate(merchant.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[#6B756A]">
                      {merchant.lastActivityAt ? relativeTime(merchant.lastActivityAt) : "Never"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {merchants && visible < rows.length && (
          <button
            onClick={() => setVisible((v) => v + 25)}
            className="w-full border-t border-[#EDEFEB] py-3 text-[13px] font-semibold text-[#6B756A] transition-colors hover:bg-[#F8F9F7]"
          >
            Show 25 more · {rows.length - visible} left
          </button>
        )}
        {merchants && rows.length === 0 && (
          <p className="px-4 py-10 text-center text-[13px] text-[#6B756A]">
            No merchant matches that search.
          </p>
        )}
      </Panel>

      {openId && (
        <MerchantPanel
          id={openId}
          onClose={() => set("id", null)}
          onChanged={load}
        />
      )}
    </AdminFrame>
  );
}

function MerchantPanel({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [merchant, setMerchant] = useState<MerchantDetailData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let live = true;
    fetchMerchant(id)
      .then((data) => {
        if (live) {
          setMerchant(data);
          setError("");
        }
      })
      .catch((err) => {
        if (live) setError((err as Error).message);
      });
    return () => {
      live = false;
    };
  }, [id]);

  if (error) {
    return (
      <Sheet open onClose={onClose} title="Couldn't load this business">
        <p className="text-[13px] text-danger-text">{error}</p>
      </Sheet>
    );
  }
  // Also covers switching straight from one merchant's panel to another's:
  // stale data from the previous id must not flash before the new fetch
  // resolves.
  if (!merchant || merchant.id !== id) {
    return (
      <Sheet open onClose={onClose} title="Loading…">
        <p className="flex items-center gap-2 py-8 text-[13px] text-[#6B756A]">
          <Loader2 className="size-4 animate-spin" />
          Fetching this business.
        </p>
      </Sheet>
    );
  }

  const suspended = Boolean(merchant.suspendedAt);
  const orderCount = merchant.recordCounts.order ?? 0;
  const productCount = merchant.recordCounts.product ?? 0;

  return (
    <Sheet
      open
      onClose={onClose}
      title={merchant.name}
      description={`${merchant.owner?.name ?? "No owner on record"} · joined ${fullDate(merchant.createdAt)}`}
      size="lg"
      footer={
        <Button
          variant={suspended ? "secondary" : "danger"}
          disabled={busy}
          onClick={async () => {
            if (suspended) {
              setBusy(true);
              try {
                setMerchant(await reinstateMerchant(id));
                toast(`${merchant.name} reinstated.`);
                onChanged();
              } catch (err) {
                toast((err as Error).message, "error");
              } finally {
                setBusy(false);
              }
            } else {
              setConfirming(true);
            }
          }}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldAlert className="size-4" />}
          {suspended ? "Reinstate account" : "Suspend account"}
        </Button>
      }
    >
      <div className="space-y-5 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={suspended ? "danger" : "success"} dot>
            {suspended ? "Suspended" : "Active"}
          </Badge>
          <span className="text-[12px] text-[#6B756A]">
            sokoos.app/store/{merchant.slug}
          </span>
          {merchant.industry && (
            <span className="text-[12px] text-[#8A948A]">{merchant.industry}</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Orders" value={num(orderCount)} />
          <Stat label="Products" value={num(productCount)} />
          <Stat
            label="Till"
            value={merchant.till ? merchant.till.shortcode : "Not connected"}
          />
          <Stat
            label="Last active"
            value={merchant.lastActivityAt ? relativeTime(merchant.lastActivityAt) : "Never"}
          />
        </div>

        <div>
          <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-[#8A948A]">
            Owner
          </p>
          <div className="space-y-1.5 rounded-2xl bg-surface-sunken p-3.5 text-[13px]">
            <p>{merchant.owner?.name ?? "No owner on record"}</p>
            {merchant.owner?.phone && <p className="tabular">{merchant.owner.phone}</p>}
            {merchant.owner?.email && <p>{merchant.owner.email}</p>}
          </div>
        </div>

        {merchant.till && (
          <div>
            <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-[#8A948A]">
              M-Pesa
            </p>
            <div className="space-y-1.5 rounded-2xl bg-surface-sunken p-3.5 text-[13px]">
              <p>
                {merchant.till.kind === "paybill" ? "Paybill" : "Till"} {merchant.till.shortcode} ·{" "}
                {merchant.till.environment}
              </p>
              <p className="text-[12px] text-[#8A948A]">
                {merchant.till.registeredAt
                  ? `Registered with Safaricom ${relativeTime(merchant.till.registeredAt)}`
                  : "Not yet registered with Safaricom"}
              </p>
              {merchant.till.lastEventAt && (
                <p className="text-[12px] text-[#8A948A]">
                  Last payment {relativeTime(merchant.till.lastEventAt)}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <ConfirmSheet
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          setBusy(true);
          try {
            setMerchant(await suspendMerchant(id, "Suspended by an operator"));
            toast(`${merchant.name} suspended.`, "error");
            onChanged();
          } catch (err) {
            toast((err as Error).message, "error");
          } finally {
            setBusy(false);
            setConfirming(false);
          }
        }}
        title={`Suspend ${merchant.name}?`}
        body="Their storefront goes offline and sync stops accepting their device — the app tells them to sign in again. Their data is kept, and you can reinstate the account at any time."
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
      <p className="tabular mt-1 truncate text-[16px] font-bold">{value}</p>
    </div>
  );
}
