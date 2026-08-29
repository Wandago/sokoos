"use client";

import { Suspense, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, BookOpen, Plus, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { Hydrated } from "@/components/ui/hydrated";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, ListSkeleton } from "@/components/ui/state";
import { LoadMore } from "@/components/ui/load-more";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { daysAgoCutoff, ledgerTotals } from "@/lib/selectors";
import { dayLabel, money } from "@/lib/format";
import { cn } from "@/lib/cn";

export default function LedgerPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Hydrated>
        <LedgerScreen />
      </Hydrated>
    </Suspense>
  );
}

type Filter = "all" | "income" | "expense" | "unreconciled";

function LedgerScreen() {
  const { db } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [range, setRange] = useState<7 | 30>(7);
  const [visible, setVisible] = useState(40);
  const [adding, setAdding] = useState(false);

  const totals = ledgerTotals(db, range);
  const cutoff = daysAgoCutoff(range);

  const entries = useMemo(() => {
    const list = db.ledger
      .filter((e) => +new Date(e.date) >= cutoff)
      .filter((e) =>
        filter === "all"
          ? true
          : filter === "unreconciled"
            ? !e.reconciled
            : e.type === filter,
      );
    return [...list].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [db.ledger, filter, cutoff]);

  // Group by day so a month of entries stays readable on a phone.
  const grouped = useMemo(() => {
    const map = new Map<string, typeof entries>();
    entries.slice(0, visible).forEach((entry) => {
      const key = dayLabel(entry.date);
      map.set(key, [...(map.get(key) ?? []), entry]);
    });
    return [...map.entries()];
  }, [entries, visible]);

  return (
    <>
      <PageHeader
        title="Ledger"
        subtitle={`Every shilling in and out, for the last ${range} days.`}
        action={
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" strokeWidth={2.5} />
            Add
          </Button>
        }
      />

      <Card className="mb-4 p-4">
        <p className="text-[12px] font-semibold text-text-secondary">
          Net for the last {range} days
        </p>
        <p
          className={cn(
            "tabular mt-1 text-[30px] font-extrabold leading-none tracking-[-0.03em]",
            totals.net >= 0 ? "text-text" : "text-danger",
          )}
        >
          {money(totals.net)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-success-soft p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-success-text">
              <ArrowDownLeft className="size-3.5" />
              Money in
            </p>
            <p className="tabular mt-1 text-[17px] font-bold text-success-text">
              {money(totals.income)}
            </p>
          </div>
          <div className="rounded-xl bg-danger-soft p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-danger-text">
              <ArrowUpRight className="size-3.5" />
              Money out
            </p>
            <p className="tabular mt-1 text-[17px] font-bold text-danger-text">
              {money(totals.expenses)}
            </p>
          </div>
        </div>
        {totals.unreconciled > 0 && (
          <p className="mt-3 text-[12px] text-text-secondary">
            {totals.unreconciled} {totals.unreconciled === 1 ? "entry is" : "entries are"} still
            waiting on a matching payment.
          </p>
        )}
      </Card>

      <div className="mb-4 space-y-3">
        <Segmented
          value={String(range) as "7" | "30"}
          onChange={(next) => {
            setRange(Number(next) as 7 | 30);
            setVisible(40);
          }}
          options={[
            { value: "7", label: "Last 7 days" },
            { value: "30", label: "Last 30 days" },
          ]}
        />
        <Segmented
          value={filter}
          onChange={(next) => {
            setFilter(next);
            setVisible(40);
          }}
          options={[
            { value: "all", label: "All" },
            { value: "income", label: "Money in" },
            { value: "expense", label: "Money out" },
            { value: "unreconciled", label: "Unreconciled", count: totals.unreconciled },
          ]}
        />
      </div>

      {grouped.length ? (
        <div className="space-y-5">
          {grouped.map(([day, dayEntries]) => (
            <div key={day}>
              <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-text-secondary">
                {day}
              </p>
              <div className="overflow-hidden rounded-card border border-border-subtle bg-surface shadow-card">
                {dayEntries.map((entry, i) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex items-center gap-3 p-3.5",
                      i > 0 && "border-t border-border-subtle",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-xl",
                        entry.type === "income"
                          ? "bg-success-soft text-success-text"
                          : "bg-danger-soft text-danger-text",
                      )}
                    >
                      {entry.type === "income" ? (
                        <ArrowDownLeft className="size-4" strokeWidth={2.5} />
                      ) : (
                        <ArrowUpRight className="size-4" strokeWidth={2.5} />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold">{entry.description}</p>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span className="truncate text-[11px] text-text-secondary">
                          {entry.category} · {entry.reference}
                        </span>
                        {entry.source === "capture" && (
                          <Sparkles className="size-3 shrink-0 text-ai" />
                        )}
                      </div>
                      {!entry.reconciled && (
                        <Badge tone="pending" className="mt-1.5">
                          Unreconciled
                        </Badge>
                      )}
                    </div>
                    <p
                      className={cn(
                        "tabular shrink-0 text-[15px] font-bold",
                        entry.type === "income" ? "text-success" : "text-text",
                      )}
                    >
                      {entry.type === "income" ? "+" : "−"}
                      {money(entry.amount).replace("KES ", "")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <LoadMore
            total={entries.length}
            visible={visible}
            step={40}
            onMore={() => setVisible((v) => v + 40)}
          />
        </div>
      ) : (
        <EmptyState
          icon={<BookOpen className="size-6" />}
          title="Nothing recorded"
          body="Delivered orders and confirmed captures land here automatically."
        />
      )}

      <AddEntrySheet open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function AddEntrySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addLedgerEntry } = useStore();
  const toast = useToast();
  const [type, setType] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Stock");

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add an entry"
      footer={
        <Button
          full
          size="lg"
          disabled={!amount || !description.trim()}
          onClick={() => {
            addLedgerEntry({
              date: new Date().toISOString(),
              type,
              category,
              description: description.trim(),
              amount: Number(amount) || 0,
              source: "manual",
              reference: `MAN-${Math.floor(Math.random() * 9000 + 1000)}`,
              reconciled: true,
            });
            setAmount("");
            setDescription("");
            onClose();
            toast("Entry added.");
          }}
        >
          Add entry
        </Button>
      }
    >
      <div className="space-y-4 pb-4">
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as "income" | "expense")}>
            <option value="expense">Money out</option>
            <option value="income">Money in</option>
          </Select>
        </Field>
        <Field label="Amount">
          <Input
            prefix="KES"
            inputMode="numeric"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
          />
        </Field>
        <Field label="Description">
          <Input
            placeholder="Rider payouts"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {["Sales", "Stock", "Packaging", "Delivery", "Marketing", "Rent", "Airtime & data", "Other"].map(
              (c) => (
                <option key={c}>{c}</option>
              ),
            )}
          </Select>
        </Field>
      </div>
    </Sheet>
  );
}
