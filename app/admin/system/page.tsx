"use client";

import { AdminFrame, Metric, Panel, PanelHead } from "@/components/admin/admin-frame";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { useAdmin } from "@/lib/admin/store";
import { fullDate, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ServiceHealth } from "@/lib/admin/types";

const serviceTone: Record<ServiceHealth["status"], "success" | "pending" | "danger"> = {
  operational: "success",
  degraded: "pending",
  down: "danger",
};

const severityTone = {
  sev1: "danger",
  sev2: "pending",
  sev3: "neutral",
} as const;

export default function SystemPage() {
  const { db, setFlag, resetAdminData } = useAdmin();
  const toast = useToast();

  const degraded = db.services.filter((s) => s.status !== "operational");
  const worstUptime = Math.min(...db.services.map((s) => s.uptime30d));
  const openIncidents = db.incidents.filter((i) => !i.resolvedAt);

  return (
    <AdminFrame
      title="System"
      subtitle="Service health, recent incidents, and what is switched on for whom."
      actions={
        <button
          onClick={() => {
            resetAdminData();
            toast("Console data reset.");
          }}
          className="inline-flex h-10 items-center rounded-full border border-[#E2E5DF] bg-white px-4 text-[13px] font-semibold text-[#4A544A] hover:bg-[#F8F9F7]"
        >
          Reset console data
        </button>
      }
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Metric
          label="Services degraded"
          value={String(degraded.length)}
          sub={degraded.length ? degraded.map((s) => s.name).join(", ") : "all operational"}
        />
        <Metric
          label="Lowest uptime, 30d"
          value={`${worstUptime.toFixed(2)}%`}
          sub="across all services"
        />
        <Metric
          label="Open incidents"
          value={String(openIncidents.length)}
          sub={`${db.incidents.length} in the last 30 days`}
        />
      </div>

      <div className="mb-5 grid gap-4 xl:grid-cols-2">
        <Panel className="overflow-hidden">
          <PanelHead title="Services" note="Rolling 30-day availability" />
          <div className="divide-y divide-[#EDEFEB]">
            {db.services.map((service) => (
              <div key={service.name} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    service.status === "operational"
                      ? "bg-success"
                      : service.status === "degraded"
                        ? "bg-pending"
                        : "bg-danger",
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                  {service.name}
                </span>
                <span className="tabular w-20 shrink-0 text-right text-[12px] text-[#6B756A]">
                  {service.latencyMs} ms
                </span>
                <span className="tabular w-20 shrink-0 text-right text-[12px] text-[#6B756A]">
                  {service.uptime30d.toFixed(2)}%
                </span>
                <Badge tone={serviceTone[service.status]}>{service.status}</Badge>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="overflow-hidden">
          <PanelHead title="Recent incidents" note="Last 30 days" />
          <div className="divide-y divide-[#EDEFEB]">
            {db.incidents.map((incident) => (
              <div key={incident.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={severityTone[incident.severity]}>
                    {incident.severity.toUpperCase()}
                  </Badge>
                  <span className="text-[13px] font-semibold">{incident.title}</span>
                  <span className="text-[11px] text-[#8A948A]">{incident.component}</span>
                </div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-[#4A544A]">{incident.note}</p>
                <p className="mt-1 text-[11px] text-[#8A948A]">
                  {fullDate(incident.startedAt)} ·{" "}
                  {incident.resolvedAt
                    ? `resolved ${relativeTime(incident.resolvedAt).toLowerCase()}`
                    : "ongoing"}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="overflow-hidden">
        <PanelHead
          title="Feature flags"
          note="Changes here reach merchants immediately"
        />
        <div className="divide-y divide-[#EDEFEB]">
          {db.flags.map((flag) => (
            <div key={flag.key} className="flex flex-wrap items-center gap-4 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold">{flag.name}</span>
                  <code className="rounded bg-[#F1F2EF] px-1.5 py-0.5 text-[11px] text-[#6B756A]">
                    {flag.key}
                  </code>
                  <span className="text-[11px] text-[#8A948A]">{flag.owner}</span>
                </div>
                <p className="mt-1 text-[12px] text-[#6B756A]">{flag.description}</p>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2">
                  <span className="sr-only">Rollout percentage for {flag.name}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={flag.rollout}
                    disabled={!flag.enabled}
                    onChange={(e) => setFlag(flag.key, { rollout: Number(e.target.value) })}
                    className="w-28 accent-brand disabled:opacity-40"
                  />
                  <span className="tabular w-10 text-right text-[12px] font-semibold">
                    {flag.rollout}%
                  </span>
                </label>

                <button
                  role="switch"
                  aria-checked={flag.enabled}
                  aria-label={`${flag.enabled ? "Disable" : "Enable"} ${flag.name}`}
                  onClick={() => {
                    setFlag(flag.key, {
                      enabled: !flag.enabled,
                      rollout: flag.enabled ? 0 : Math.max(flag.rollout, 5),
                    });
                    toast(`${flag.name} ${flag.enabled ? "disabled" : "enabled"}.`);
                  }}
                  className={cn(
                    "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                    flag.enabled ? "bg-brand" : "bg-[#D6DAD3]",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]",
                      flag.enabled ? "left-[22px]" : "left-0.5",
                    )}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </AdminFrame>
  );
}
