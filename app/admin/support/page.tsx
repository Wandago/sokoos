"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, Clock, Loader2, UserPlus } from "lucide-react";
import { AdminFrame, Metric, Panel } from "@/components/admin/admin-frame";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  assignTicket,
  fetchTickets,
  setTicketStatus,
  type AdminTicket,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/admin/api";
import { useQuery } from "@/lib/use-query";
import { relativeTime } from "@/lib/format";

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
  const { get, set } = useQuery();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("queue");
  const [tickets, setTickets] = useState<AdminTicket[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const selected = get("id");

  useEffect(() => {
    fetchTickets()
      .then(setTickets)
      .catch((err) => setError((err as Error).message));
  }, []);

  const tallies = useMemo(() => {
    const rows = tickets ?? [];
    return {
      queue: rows.filter((t) => t.status !== "solved").length,
      open: rows.filter((t) => t.status === "open").length,
      pending: rows.filter((t) => t.status === "pending").length,
      solved: rows.filter((t) => t.status === "solved").length,
    };
  }, [tickets]);

  const rows = (tickets ?? []).filter((t) =>
    filter === "queue" ? t.status !== "solved" : t.status === filter,
  );

  async function solve(ticket: AdminTicket) {
    setBusy(ticket.id);
    try {
      setTickets(await setTicketStatus(ticket.id, "solved"));
      toast("Ticket solved.");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  async function take(ticket: AdminTicket) {
    setBusy(ticket.id);
    try {
      setTickets(await assignTicket(ticket.id, "You"));
      toast("Assigned to you.");
    } catch (err) {
      toast((err as Error).message, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminFrame
      title="Support"
      subtitle="Tickets merchants have raised directly, ordered oldest-open first."
    >
      {error && (
        <p className="mb-4 flex items-center gap-2 rounded-2xl bg-danger-soft p-3.5 text-[13px] font-medium text-danger-text">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Metric label="In the queue" value={String(tallies.queue)} sub="open and pending" />
        <Metric label="Open" value={String(tallies.open)} sub="not yet picked up" />
        <Metric label="Solved" value={String(tallies.solved)} sub="all time" />
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

      {!tickets ? (
        <p className="flex items-center gap-2 py-12 text-[13px] text-[#6B756A]">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </p>
      ) : rows.length === 0 ? (
        <Panel>
          <p className="px-4 py-12 text-center text-[13px] text-[#6B756A]">
            Nothing here. Inbox zero.
          </p>
        </Panel>
      ) : (
        <div className="space-y-3">
          {rows.map((ticket) => {
            const expanded = selected === ticket.id;
            return (
              <Panel key={ticket.id}>
                <div className="flex flex-wrap items-start gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[14px] font-bold">{ticket.subject}</h3>
                      <Badge tone={statusTone[ticket.status]} dot>
                        {ticket.status}
                      </Badge>
                      <Badge tone={priorityTone[ticket.priority]}>{ticket.priority}</Badge>
                      {ticket.status !== "solved" && (
                        <span className="tabular inline-flex items-center gap-1 text-[11px] font-semibold text-[#8A948A]">
                          <Clock className="size-3" />
                          opened {relativeTime(ticket.createdAt).toLowerCase()}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-[#4A544A]">
                      {ticket.message}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[12px] text-[#8A948A]">
                      <Link
                        href={`/admin/merchants?id=${ticket.merchant.id}`}
                        className="font-semibold text-[#4A544A] hover:underline"
                      >
                        {ticket.merchant.name}
                      </Link>
                      <span>opened {relativeTime(ticket.createdAt)}</span>
                      {ticket.assignee && <span>· {ticket.assignee}</span>}
                    </div>
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
                        disabled={busy === ticket.id}
                        onClick={() => take(ticket)}
                      >
                        <UserPlus className="size-3.5" />
                        Take it
                      </Button>
                    )}
                    {ticket.status !== "solved" && (
                      <Button size="sm" disabled={busy === ticket.id} onClick={() => solve(ticket)}>
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
