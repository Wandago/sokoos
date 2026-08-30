"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Clock, UserPlus } from "lucide-react";
import { AdminFrame, Metric, Panel } from "@/components/admin/admin-frame";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAdmin } from "@/lib/admin/store";
import { merchantById, queueCounts } from "@/lib/admin/selectors";
import type { TicketPriority, TicketStatus } from "@/lib/admin/types";
import { useQuery } from "@/lib/use-query";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

export default function SupportPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#F4F5F3]" />}>
      <Support />
    </Suspense>
  );
}

type Filter = "queue" | TicketStatus;

const priorityTone: Record<TicketPriority, "danger" | "pending" | "neutral" | "brand"> = {
  urgent: "danger",
  high: "pending",
  normal: "neutral",
  low: "neutral",
};

const statusTone: Record<TicketStatus, "brand" | "pending" | "success"> = {
  open: "brand",
  pending: "pending",
  solved: "success",
};

function Support() {
  const { db, setTicketStatus, assignTicket } = useAdmin();
  const { get, set } = useQuery();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("queue");
  const counts = queueCounts(db);
  const selected = get("id");

  const tallies = useMemo(
    () => ({
      queue: db.tickets.filter((t) => t.status !== "solved").length,
      open: db.tickets.filter((t) => t.status === "open").length,
      pending: db.tickets.filter((t) => t.status === "pending").length,
      solved: db.tickets.filter((t) => t.status === "solved").length,
    }),
    [db.tickets],
  );

  const rows = db.tickets
    .filter((t) => (filter === "queue" ? t.status !== "solved" : t.status === filter))
    // Breached first, then by how little time is left.
    .sort((a, b) => a.slaHours - b.slaHours);

  return (
    <AdminFrame
      title="Support"
      subtitle="Merchant tickets, ordered by how close each is to missing its first-response target."
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Metric label="In the queue" value={String(tallies.queue)} sub="open and pending" />
        <Metric
          label="Past SLA"
          value={String(counts.breached)}
          sub={counts.breached === 1 ? "first response overdue" : "first responses overdue"}
        />
        <Metric label="Solved" value={String(tallies.solved)} sub="all time in this dataset" />
      </div>

      <Segmented
        className="mb-4"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "queue", label: "Queue", count: tallies.queue },
          { value: "open", label: "Open", count: tallies.open },
          { value: "pending", label: "Pending", count: tallies.pending },
          { value: "solved", label: "Solved", count: tallies.solved },
        ]}
      />

      {rows.length === 0 ? (
        <Panel>
          <p className="px-4 py-12 text-center text-[13px] text-[#6B756A]">
            Nothing here. Inbox zero.
          </p>
        </Panel>
      ) : (
        <div className="space-y-3">
          {rows.map((ticket) => {
            const merchant = merchantById(db, ticket.merchantId);
            const breached = ticket.slaHours < 0 && ticket.status !== "solved";
            const expanded = selected === ticket.id;
            return (
              <Panel key={ticket.id} className={cn(breached && "border-danger/40")}>
                <div className="flex flex-wrap items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14px] font-bold">{ticket.subject}</h3>
                      <Badge tone={statusTone[ticket.status]} dot>
                        {ticket.status}
                      </Badge>
                      <Badge tone={priorityTone[ticket.priority]}>{ticket.priority}</Badge>
                      {ticket.status !== "solved" && (
                        <span
                          className={cn(
                            "tabular inline-flex items-center gap-1 text-[11px] font-semibold",
                            breached ? "text-danger" : "text-[#8A948A]",
                          )}
                        >
                          <Clock className="size-3" />
                          {breached
                            ? `${Math.abs(ticket.slaHours).toFixed(1)}h overdue`
                            : `${ticket.slaHours.toFixed(1)}h left`}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-[#4A544A]">
                      {ticket.preview}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px] text-[#8A948A]">
                      {merchant && (
                        <Link
                          href={`/admin/merchants?id=${merchant.id}`}
                          className="font-semibold text-[#4A544A] hover:underline"
                        >
                          {merchant.business}
                        </Link>
                      )}
                      <span>opened {relativeTime(ticket.openedAt)}</span>
                      {ticket.assignee && <span>· {ticket.assignee}</span>}
                    </div>

                    {expanded && merchant && (
                      <div className="mt-3 rounded-xl bg-[#F8F9F7] p-3 text-[12px] leading-relaxed text-[#4A544A]">
                        <p>
                          {merchant.owner} · {merchant.email} · {merchant.phone}
                        </p>
                        <p className="mt-1">
                          {merchant.plan} plan · {merchant.products} products · {merchant.region}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => set("id", expanded ? null : ticket.id)}
                    >
                      {expanded ? "Hide" : "Context"}
                    </Button>
                    {!ticket.assignee && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          assignTicket(ticket.id, "You");
                          toast("Assigned to you.");
                        }}
                      >
                        <UserPlus className="size-3.5" />
                        Take it
                      </Button>
                    )}
                    {ticket.status !== "solved" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setTicketStatus(ticket.id, "solved");
                          toast("Ticket solved.");
                        }}
                      >
                        <Check className="size-3.5" strokeWidth={3} />
                        Solve
                      </Button>
                    )}
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </AdminFrame>
  );
}
