"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  FileText,
  Receipt,
  ScanLine,
  Smartphone,
  Sparkles,
  Upload,
} from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/ui/page";
import { Hydrated } from "@/components/ui/hydrated";
import { EmptyState, ListSkeleton } from "@/components/ui/state";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { Badge, ConfidenceMeter } from "@/components/ui/badge";
import { Card, Divider } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { useQuery } from "@/lib/use-query";
import { fullDate, money, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Capture, CaptureKind } from "@/lib/types";

export default function CapturePage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Hydrated>
        <CaptureScreen />
      </Hydrated>
    </Suspense>
  );
}

const kindLabel: Record<CaptureKind, string> = {
  receipt: "Receipt",
  mpesa_message: "M-Pesa message",
  mpesa_statement: "M-Pesa statement",
  bank_statement: "Bank statement",
  invoice: "Invoice",
};

const kindIcon: Record<CaptureKind, typeof Receipt> = {
  receipt: Receipt,
  mpesa_message: Smartphone,
  mpesa_statement: FileText,
  bank_statement: FileText,
  invoice: FileText,
};

const stages = ["Capture", "Understand", "Match", "Confirm", "Ledger"];

function CaptureScreen() {
  const { db } = useStore();
  const { get, set } = useQuery();
  const uploading = get("new") === "1";

  const open = db.captures.find((c) => c.id === get("id"));
  const review = db.captures.filter((c) => c.status === "needs_review");
  const confirmed = db.captures.filter((c) => c.status === "confirmed");

  return (
    <>
      <PageHeader
        title="Smart Capture"
        subtitle="Snap it. We organise it. Receipts, M-Pesa messages and statements become records."
      />

      <UploadArea onOpen={() => set("new", "1")} />

      {/* How it works — the five-step promise, stated plainly. */}
      <div className="mb-6 mt-4 flex flex-wrap gap-2">
        {stages.map((stage, i) => (
          <div
            key={stage}
            className="flex shrink-0 items-center gap-2 rounded-full bg-surface-sunken px-3 py-1.5 text-[11px] font-semibold text-text-secondary"
          >
            <span className="tabular flex size-4 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-brand-ink">
              {i + 1}
            </span>
            {stage}
          </div>
        ))}
      </div>

      {review.length > 0 && (
        <>
          <SectionTitle>Needs your review</SectionTitle>
          <div className="mb-6 space-y-2.5">
            {review.map((capture) => (
              <CaptureCard key={capture.id} capture={capture} onOpen={() => set("id", capture.id)} />
            ))}
          </div>
        </>
      )}

      <SectionTitle>Filed automatically</SectionTitle>
      {confirmed.length ? (
        <div className="space-y-2.5">
          {confirmed.map((capture) => (
            <CaptureCard key={capture.id} capture={capture} onOpen={() => set("id", capture.id)} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<ScanLine className="size-6" />}
          title="Nothing filed yet"
          body="Upload a receipt or an M-Pesa message and it will land in your ledger."
        />
      )}

      {open && <CaptureDetail capture={open} onClose={() => set("id", null)} />}
      <UploadSheet open={uploading} onClose={() => set("new", null)} />
    </>
  );
}

function UploadArea({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="relative flex w-full flex-col items-center overflow-hidden rounded-card bg-panel px-6 py-8 text-center text-panel-text shadow-float ring-1 ring-white/5"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 left-1/2 size-60 -translate-x-1/2 rounded-full opacity-35 blur-2xl"
        style={{ background: "radial-gradient(circle, var(--lime-500), transparent 70%)" }}
      />
      <span className="relative mb-3 flex size-12 items-center justify-center rounded-2xl bg-brand text-brand-ink">
        <Camera className="size-6" strokeWidth={2.1} />
      </span>
      <span className="relative text-[15px] font-bold">Capture a document</span>
      <span className="relative mt-1 max-w-xs text-[13px] leading-relaxed text-panel-muted">
        Photograph a receipt, upload an M-Pesa screenshot, or drop in a full statement.
      </span>
      <span className="relative mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-[13px] font-semibold text-brand-ink">
        <Upload className="size-4" />
        Choose a file
      </span>
    </button>
  );
}

function CaptureCard({ capture, onOpen }: { capture: Capture; onOpen: () => void }) {
  const Icon = kindIcon[capture.kind];
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-card border border-border-subtle bg-surface p-3.5 text-left shadow-card transition-colors hover:bg-surface-hover"
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl",
          capture.status === "needs_review"
            ? "bg-pending-soft text-pending-text"
            : "bg-success-soft text-success-text",
        )}
      >
        <Icon className="size-5" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[15px] font-semibold">
            {capture.extracted.merchant ?? capture.extracted.customer ?? capture.fileName}
          </p>
          {capture.extracted.amount !== undefined && (
            <p className="tabular shrink-0 text-[15px] font-bold">
              {money(capture.extracted.amount)}
            </p>
          )}
        </div>
        <p className="mt-0.5 truncate text-[12px] text-text-secondary">
          {kindLabel[capture.kind]} · {relativeTime(capture.uploadedAt)}
        </p>
        <div className="mt-2 flex items-center gap-2">
          {capture.status === "needs_review" ? (
            <Badge tone="pending">Needs review</Badge>
          ) : (
            <Badge tone="success">
              <Check className="size-3" strokeWidth={3} />
              In your ledger
            </Badge>
          )}
          <ConfidenceMeter value={capture.confidence} className="ml-auto" />
        </div>
      </div>
    </button>
  );
}

function CaptureDetail({ capture, onClose }: { capture: Capture; onClose: () => void }) {
  const { confirmCapture } = useStore();
  const toast = useToast();
  const fields = capture.extracted;

  return (
    <Sheet
      open
      onClose={onClose}
      title={kindLabel[capture.kind]}
      description={capture.fileName}
      size="lg"
      footer={
        capture.status === "confirmed" ? (
          <Button variant="secondary" full onClick={onClose}>
            Close
          </Button>
        ) : (
          <Button
            full
            size="lg"
            onClick={() => {
              confirmCapture(capture.id);
              onClose();
              toast("Filed. Your books are up to date.");
            }}
          >
            <Check className="size-4" strokeWidth={2.5} />
            Confirm and file
          </Button>
        )
      }
    >
      <div className="space-y-4 pb-4">
        <div className="flex items-center gap-2 rounded-2xl bg-ai-soft p-3.5">
          <Sparkles className="size-4 shrink-0 text-ai" />
          <span className="text-[13px] font-medium text-ai-text">
            {capture.confidence >= 0.9
              ? "We read this clearly."
              : "Check the details below before filing."}
          </span>
          <ConfidenceMeter value={capture.confidence} className="ml-auto" />
        </div>

        {capture.note && (
          <p className="rounded-2xl bg-surface-sunken p-3.5 text-[13px] leading-relaxed text-text-secondary">
            {capture.note}
          </p>
        )}

        <Card>
          <div className="p-4">
            <p className="mb-3 text-[12px] font-bold uppercase tracking-[0.06em] text-text-secondary">
              What we read
            </p>
            <div className="space-y-2.5 text-[14px]">
              {fields.amount !== undefined && (
                <Row label="Amount" value={money(fields.amount)} strong />
              )}
              {fields.date && <Row label="Date" value={fullDate(fields.date)} />}
              {fields.merchant && <Row label="Merchant" value={fields.merchant} />}
              {fields.customer && <Row label="Customer" value={fields.customer} />}
              {fields.transactionId && <Row label="Transaction ID" value={fields.transactionId} />}
              {fields.method && <Row label="Method" value={fields.method.toUpperCase()} />}
              {fields.category && <Row label="Category" value={fields.category} />}
              {fields.tax !== undefined && <Row label="Tax" value={money(fields.tax)} />}
            </div>

            {fields.items && fields.items.length > 0 && (
              <>
                <Divider className="my-3.5" />
                <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-text-secondary">
                  Line items
                </p>
                <div className="space-y-2">
                  {fields.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="truncate">
                        {item.qty} × {item.name}
                      </span>
                      <span className="tabular shrink-0 font-semibold">{money(item.price)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </Sheet>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-text-secondary">{label}</span>
      <span className={cn("tabular text-right font-medium", strong && "text-[17px] font-bold")}>
        {value}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Upload — Capture → Understand → Match → Confirm.
 * The extraction here is simulated locally so the flow works offline.
 * ------------------------------------------------------------------ */

const kindOptions: { value: CaptureKind; label: string; hint: string }[] = [
  { value: "receipt", label: "Receipt", hint: "A shop or supplier receipt" },
  { value: "mpesa_message", label: "M-Pesa message", hint: "A confirmation SMS screenshot" },
  { value: "mpesa_statement", label: "M-Pesa statement", hint: "A full statement PDF" },
  { value: "bank_statement", label: "Bank statement", hint: "A bank statement PDF" },
  { value: "invoice", label: "Invoice", hint: "A supplier invoice" },
];

function UploadSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addCapture } = useStore();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [kind, setKind] = useState<CaptureKind>("receipt");
  const [fileName, setFileName] = useState("");
  const [stage, setStage] = useState(-1);
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("Stock");

  const reset = () => {
    setFileName("");
    setStage(-1);
    setAmount("");
    setMerchant("");
  };

  // Walk the stages so the user can see what the system is doing.
  useEffect(() => {
    if (stage < 0 || stage >= 2) return;
    const timer = setTimeout(() => setStage((s) => s + 1), 700);
    return () => clearTimeout(timer);
  }, [stage]);

  const onFile = (name: string) => {
    setFileName(name);
    setStage(0);
  };

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Capture a document"
      description="It stays on this device — nothing is uploaded."
      size="lg"
      footer={
        stage >= 2 ? (
          <Button
            full
            size="lg"
            disabled={!amount}
            onClick={() => {
              addCapture({
                id: `cap_${Math.random().toString(36).slice(2, 9)}`,
                kind,
                fileName: fileName || "captured-document",
                uploadedAt: new Date().toISOString(),
                status: "needs_review",
                confidence: 0.86,
                extracted: {
                  amount: Number(amount) || 0,
                  date: new Date().toISOString(),
                  merchant: merchant.trim() || undefined,
                  category,
                  method: kind === "mpesa_message" ? "mpesa" : undefined,
                },
              });
              reset();
              onClose();
              toast("Captured. Review it when you're ready.");
            }}
          >
            Save for review
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4 pb-4">
        <Field label="What is it?">
          <Select value={kind} onChange={(e) => setKind(e.target.value as CaptureKind)}>
            {kindOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} — {option.hint}
              </option>
            ))}
          </Select>
        </Field>

        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0]?.name ?? "captured-document")}
        />

        {stage < 0 ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-surface-hover"
            >
              <Camera className="size-6 text-ai" />
              <span className="text-[13px] font-semibold">Take a photo</span>
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-5 transition-colors hover:bg-surface-hover"
            >
              <Upload className="size-6 text-ai" />
              <span className="text-[13px] font-semibold">Upload a file</span>
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-border-subtle bg-surface p-4">
            <p className="truncate text-[13px] font-semibold">{fileName}</p>
            <div className="mt-3 space-y-2.5">
              {stages.slice(0, 3).map((label, i) => (
                <div key={label} className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full text-[10px] font-bold",
                      i <= stage ? "bg-brand text-brand-ink" : "bg-surface-sunken text-text-muted",
                    )}
                  >
                    {i < stage ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "text-[13px]",
                      i <= stage ? "font-semibold text-text" : "text-text-muted",
                    )}
                  >
                    {label === "Capture"
                      ? "Reading the document"
                      : label === "Understand"
                        ? "Pulling out the details"
                        : "Checking against your orders"}
                  </span>
                  {i === stage && stage < 2 && (
                    <span className="ml-auto text-[11px] text-text-muted">working…</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {stage >= 2 && (
          <>
            <div className="flex items-center gap-2 rounded-2xl bg-ai-soft p-3.5 text-[13px] text-ai-text">
              <Sparkles className="size-4 shrink-0" />
              Fill in what we couldn&apos;t read, then save it for review.
            </div>
            <Field label="Amount">
              <Input
                prefix="KES"
                inputMode="numeric"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              />
            </Field>
            <Field label="Merchant or customer">
              <Input
                placeholder="Gikomba Fabrics"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
              />
            </Field>
            <Field label="Category">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {["Stock", "Packaging", "Delivery", "Marketing", "Rent", "Airtime & data", "Sales"].map(
                  (c) => (
                    <option key={c}>{c}</option>
                  ),
                )}
              </Select>
            </Field>
          </>
        )}
      </div>
    </Sheet>
  );
}
