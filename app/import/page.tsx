"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  CircleAlert,
  Copy,
  FileText,
  History,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/ui/page";
import { Hydrated } from "@/components/ui/hydrated";
import { ListSkeleton } from "@/components/ui/state";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { dedupe, parseStatement, sampleStatement, categorise } from "@/lib/statements";
import { fullDate, money, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { StatementRow, StatementRowState } from "@/lib/types";

export default function ImportPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Hydrated>
        <ImportScreen />
      </Hydrated>
    </Suspense>
  );
}

const stateMeta: Record<
  StatementRowState,
  { label: string; tone: "success" | "neutral" | "pending" | "ai"; blurb: string }
> = {
  new: { label: "New", tone: "success", blurb: "Not in your books yet." },
  already_imported: {
    label: "Already imported",
    tone: "neutral",
    blurb: "This code is already in your books.",
  },
  duplicate_in_file: {
    label: "Twice in this file",
    tone: "pending",
    blurb: "The same code appears more than once.",
  },
  needs_review: { label: "Needs review", tone: "ai", blurb: "No code, so we cannot be sure." },
};

function ImportScreen() {
  const { db, commitStatementImport } = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [skipped, setSkipped] = useState<string[] | null>(null);
  // Rows the seller has chosen to import, keyed by index into the parse.
  const [keep, setKeep] = useState<Set<number> | null>(null);

  const parsed = useMemo(() => (text.trim() ? parseStatement(text) : null), [text]);
  const summary = useMemo(() => (parsed ? dedupe(parsed.rows, db) : null), [parsed, db]);

  // Default selection: everything new, nothing already known.
  const selected = useMemo(() => {
    if (!summary) return new Set<number>();
    if (keep) return keep;
    return new Set(summary.rows.map((r, i) => (r.state === "new" ? i : -1)).filter((i) => i >= 0));
  }, [summary, keep]);

  const toggle = (index: number) => {
    const next = new Set(selected);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setKeep(next);
  };

  const load = (value: string, name: string) => {
    const result = parseStatement(value);
    setText(value);
    setFileName(name);
    setSkipped(result.skipped);
    setKeep(null);
  };

  const clear = () => {
    setText("");
    setFileName("");
    setSkipped(null);
    setKeep(null);
  };

  const commit = () => {
    if (!summary || !parsed) return;
    const rows = summary.rows.filter((_, i) => selected.has(i));
    if (!rows.length) return;
    commitStatementImport({
      source: parsed.source,
      fileName: fileName || "pasted-statement",
      rows,
      parsed: summary.total,
    });
    toast(
      `${rows.length} ${rows.length === 1 ? "row" : "rows"} filed. ${
        summary.total - rows.length
      } skipped as already yours.`,
    );
    clear();
  };

  return (
    <>
      <PageHeader
        title="Import a statement"
        subtitle="Paste or upload an M-Pesa or bank statement for any period. Every transaction carries a unique code, so anything already in your books is recognised and skipped."
      />

      {!summary ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-surface-hover"
            >
              <Upload className="size-6 text-ai" />
              <span className="text-[13px] font-semibold">Upload a file</span>
              <span className="text-[11px] text-text-muted">.csv or .txt</span>
            </button>
            <button
              onClick={() => load(sampleStatement(db), "sample-mpesa-statement.csv")}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-surface-hover"
            >
              <FileText className="size-6 text-ai" />
              <span className="text-[13px] font-semibold">Try a sample</span>
              <span className="text-[11px] text-text-muted">Overlaps your books</span>
            </button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,.txt,text/plain,text/csv"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              load(await file.text(), file.name);
            }}
          />

          <Field
            label="Or paste the statement"
            hint="Copy the rows straight out of the app or the emailed statement."
          >
            <Textarea
              rows={7}
              placeholder={"QGH4X8K2LM,2026-08-29 09:14:22,Received from JANE WANJIKU,4200.00,,182430.55"}
              value={text}
              onChange={(e) => load(e.target.value, fileName || "pasted-statement")}
            />
          </Field>

          <Card className="mt-5">
            <div className="flex gap-3 p-4">
              <ShieldCheck className="size-5 shrink-0 text-success" />
              <p className="text-[13px] leading-relaxed text-text-secondary">
                The file is read on this phone and never leaves it. Duplicate detection is an exact
                match on the transaction code — not a guess — so importing the same period twice is
                safe.
              </p>
            </div>
          </Card>

          {db.imports.length > 0 && (
            <>
              <SectionTitle className="mt-7">Past imports</SectionTitle>
              <div className="space-y-2.5">
                {db.imports.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center gap-3 rounded-card border border-border-subtle bg-surface p-3.5"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-text-secondary">
                      <History className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold">{record.fileName}</p>
                      <p className="mt-0.5 text-[12px] text-text-secondary">
                        {relativeTime(record.importedAt)} · {record.rowsImported} filed ·{" "}
                        {record.rowsDuplicate} skipped
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-surface-sunken px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">{fileName || "Pasted statement"}</p>
              <p className="text-[12px] text-text-secondary">
                {parsed?.source === "bank" ? "Bank statement" : "M-Pesa statement"}
                {parsed?.periodStart && (
                  <>
                    {" · "}
                    {fullDate(parsed.periodStart)} – {fullDate(parsed.periodEnd!)}
                  </>
                )}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={clear}>
              Start over
            </Button>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2.5">
            <Tally label="New to file" value={summary.fresh} tone="success" icon={Check} />
            <Tally
              label="Already yours"
              value={summary.alreadyImported}
              tone="neutral"
              icon={ShieldCheck}
            />
            <Tally
              label="Twice in file"
              value={summary.duplicateInFile}
              tone="pending"
              icon={Copy}
            />
            <Tally
              label="Needs review"
              value={summary.needsReview}
              tone="ai"
              icon={CircleAlert}
            />
          </div>

          {summary.alreadyImported > 0 && (
            <div className="mb-5 flex gap-3 rounded-2xl bg-success-soft p-3.5">
              <ShieldCheck className="size-5 shrink-0 text-success-text" />
              <p className="text-[13px] leading-relaxed text-success-text">
                {summary.alreadyImported} of these {summary.total} transactions are already in your
                books. We matched them by transaction code, so nothing will be counted twice.
              </p>
            </div>
          )}

          <SectionTitle
            action={
              <span className="text-[12px] font-semibold text-text-secondary">
                {selected.size} selected
              </span>
            }
          >
            {summary.total} transactions
          </SectionTitle>

          <div className="space-y-2.5 pb-24">
            {summary.rows.map((row, i) => (
              <RowCard
                key={`${row.code}-${i}`}
                row={row}
                checked={selected.has(i)}
                onToggle={() => toggle(i)}
              />
            ))}
          </div>

          {skipped && skipped.length > 0 && (
            <details className="mb-4 rounded-2xl border border-border-subtle bg-surface p-4">
              <summary className="cursor-pointer text-[13px] font-semibold">
                {skipped.length} {skipped.length === 1 ? "line" : "lines"} we could not read
              </summary>
              <div className="mt-3 space-y-1.5">
                {skipped.slice(0, 12).map((line, i) => (
                  <p key={i} className="truncate font-mono text-[11px] text-text-muted">
                    {line}
                  </p>
                ))}
              </div>
            </details>
          )}

          {/* Pinned above the nav bar so the verdict is always one tap away,
              without ever sitting on top of a row. */}
          <div className="pb-safe fixed inset-x-0 bottom-[76px] z-30 px-4 lg:static lg:px-0 lg:pb-0">
            <Button full size="lg" disabled={!selected.size} onClick={commit} className="shadow-float">
              File {selected.size} {selected.size === 1 ? "transaction" : "transactions"}
            </Button>
          </div>
        </>
      )}
    </>
  );
}

function Tally({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: "success" | "neutral" | "pending" | "ai";
  icon: typeof Check;
}) {
  const skin = {
    success: "bg-success-soft text-success-text",
    neutral: "bg-surface-sunken text-text-secondary",
    pending: "bg-pending-soft text-pending-text",
    ai: "bg-ai-soft text-ai-text",
  }[tone];

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-3.5">
      <span className={cn("mb-2 flex size-9 items-center justify-center rounded-xl", skin)}>
        <Icon className="size-[18px]" strokeWidth={2.1} />
      </span>
      <p className="tabular text-[22px] font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-[12px] text-text-secondary">{label}</p>
    </div>
  );
}

function RowCard({
  row,
  checked,
  onToggle,
}: {
  row: StatementRow;
  checked: boolean;
  onToggle: () => void;
}) {
  const meta = stateMeta[row.state];
  const credit = row.direction === "credit";

  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex w-full items-start gap-3 rounded-card border p-3.5 text-left transition-colors",
        checked
          ? "border-brand bg-surface shadow-card"
          : "border-border-subtle bg-surface-sunken",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
          checked ? "border-transparent bg-brand text-brand-ink" : "border-border-strong",
        )}
      >
        {checked && <Check className="size-3.5" strokeWidth={3} />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[14px] font-semibold">{row.description || "Transaction"}</p>
          <p
            className={cn(
              "tabular shrink-0 text-[15px] font-bold",
              credit ? "text-success-text" : "text-text",
            )}
          >
            {credit ? "+" : "−"}
            {money(row.amount)}
          </p>
        </div>

        <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-text-secondary">
          {credit ? (
            <ArrowDownLeft className="size-3.5 text-success" />
          ) : (
            <ArrowUpRight className="size-3.5 text-text-muted" />
          )}
          {credit ? "Money in" : "Money out"} · {categorise(row.description, row.direction)} ·{" "}
          {fullDate(row.date)}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge tone={meta.tone}>{meta.label}</Badge>
          <span className="font-mono text-[11px] text-text-muted">{row.code || "no code"}</span>
        </div>

        {row.note && <p className="mt-1.5 text-[11px] text-text-muted">{row.note}</p>}
      </div>
    </button>
  );
}
