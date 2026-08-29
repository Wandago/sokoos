"use client";

import { Suspense, useMemo, useState } from "react";
import { Check, Link2, Sparkles, Wallet, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { Hydrated } from "@/components/ui/hydrated";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, ListSkeleton } from "@/components/ui/state";
import { LoadMore } from "@/components/ui/load-more";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { AmountKeypad } from "@/components/ui/amount-keypad";
import { Badge, ConfidenceMeter, PaymentStateBadge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/chart";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { useQuery } from "@/lib/use-query";
import { customerOf, orderTotal, unmatchedPayments } from "@/lib/selectors";
import { clockTime, dayLabel, isSameDay, money, relativeTime } from "@/lib/format";
import type { Payment, PaymentMethod } from "@/lib/types";

export default function PaymentsPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Hydrated>
        <PaymentsScreen />
      </Hydrated>
    </Suspense>
  );
}

type Filter = "all" | "review" | "received" | "pending" | "failed";

const methodLabel: Record<PaymentMethod, string> = {
  mpesa: "M-Pesa",
  cash: "Cash",
  bank: "Bank transfer",
  card: "Card",
};

function PaymentsScreen() {
  const { db } = useStore();
  const { get, set } = useQuery();
  const [filter, setFilter] = useState<Filter>("all");
  const [visible, setVisible] = useState(30);

  const creating = get("new") === "1";
  const matching = db.payments.find((p) => p.id === get("match"));

  const unmatched = unmatchedPayments(db);
  const today = db.payments.filter(
    (p) => isSameDay(p.receivedAt, new Date()) && p.state === "received",
  );
  const receivedToday = today.reduce((sum, p) => sum + p.amount, 0);

  const counts = {
    all: db.payments.length,
    review: db.payments.filter((p) => p.state !== "failed" && (p.state === "review" || !p.matched))
      .length,
    received: db.payments.filter((p) => p.state === "received").length,
    pending: db.payments.filter((p) => p.state === "pending").length,
    failed: db.payments.filter((p) => p.state === "failed").length,
  };

  const payments = useMemo(() => {
    const list =
      filter === "all"
        ? db.payments
        : filter === "review"
          ? db.payments.filter((p) => p.state !== "failed" && (p.state === "review" || !p.matched))
          : db.payments.filter((p) => p.state === filter);
    return [...list].sort((a, b) => +new Date(b.receivedAt) - +new Date(a.receivedAt));
  }, [db.payments, filter]);

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Every shilling that came in, matched to the order it belongs to."
        action={
          <Button size="sm" onClick={() => set("new", "1")}>
            <Wallet className="size-4" />
            Record
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-2.5">
        <StatTile label="In today" unit="KES" value={money(receivedToday, { compact: true, bare: true })} />
        <StatTile
          label="Unmatched"
          value={String(unmatched.length)}
          tone={unmatched.length ? "danger" : "default"}
        />
        <StatTile
          label="Pending"
          value={String(counts.pending)}
          tone={counts.pending ? "brand" : "default"}
        />
      </div>

      {unmatched.length > 0 && (
        <div className="mb-4 rounded-card border border-transparent bg-ai-soft p-4">
          <div className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ai text-white">
              <Sparkles className="size-[18px]" strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold leading-snug">
                We found {unmatched.length} payments that haven&apos;t been matched.
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-ai-text/80">
                Match each one to an order and your ledger balances itself.
              </p>
              <Button size="sm" variant="ai" className="mt-3" onClick={() => {
                  setFilter("review");
                  setVisible(30);
                }}>
                Review them
              </Button>
            </div>
          </div>
        </div>
      )}

      <Segmented
        className="mb-4"
        value={filter}
        onChange={(next) => {
          setFilter(next);
          setVisible(30);
        }}
        options={[
          { value: "all", label: "All", count: counts.all },
          { value: "review", label: "Needs review", count: counts.review },
          { value: "received", label: "Received", count: counts.received },
          { value: "pending", label: "Pending", count: counts.pending },
          { value: "failed", label: "Failed", count: counts.failed },
        ]}
      />

      {payments.length ? (
        <>
          <div className="space-y-2.5">
            {payments.slice(0, visible).map((payment) => (
              <PaymentCard
                key={payment.id}
                payment={payment}
                onMatch={() => set("match", payment.id)}
              />
            ))}
          </div>
          <LoadMore
            total={payments.length}
            visible={visible}
            onMore={() => setVisible((v) => v + 30)}
          />
        </>
      ) : (
        <EmptyState
          icon={<Wallet className="size-6" />}
          title="Nothing here"
          body="Payments you record, and the ones Smart Capture reads, show up here."
        />
      )}

      {matching && <MatchSheet payment={matching} onClose={() => set("match", null)} />}
      <RecordPaymentSheet open={creating} onClose={() => set("new", null)} />
    </>
  );
}

function PaymentCard({ payment, onMatch }: { payment: Payment; onMatch: () => void }) {
  const { db } = useStore();
  const order = db.orders.find((o) => o.id === payment.orderId);

  return (
    <div className="rounded-card border border-border-subtle bg-surface p-3.5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold">{payment.customerName}</p>
          <p className="mt-0.5 truncate text-[12px] text-text-secondary">
            {methodLabel[payment.method]}
            {payment.reference && ` · ${payment.reference}`}
          </p>
        </div>
        <p
          className={`tabular shrink-0 text-[17px] font-bold ${payment.state === "failed" ? "text-text-muted line-through" : ""}`}
        >
          {money(payment.amount)}
        </p>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <PaymentStateBadge state={payment.state} />
        {order ? (
          <Badge tone="success">
            <Link2 className="size-3" />
            {order.code}
          </Badge>
        ) : payment.state !== "failed" ? (
          <Badge tone="pending">Not matched</Badge>
        ) : null}
        {payment.source === "capture" && <Badge tone="ai">From Smart Capture</Badge>}
        <span className="ml-auto text-[11px] text-text-muted">
          {dayLabel(payment.receivedAt)} · {clockTime(payment.receivedAt)}
        </span>
      </div>

      {payment.confidence !== undefined && (
        <div className="mt-2.5 flex items-center gap-2 border-t border-border-subtle pt-2.5">
          <Sparkles className="size-3.5 text-ai" />
          <span className="text-[11px] font-medium text-text-secondary">AI read this</span>
          <ConfidenceMeter value={payment.confidence} className="ml-auto" />
        </div>
      )}

      {!payment.matched && payment.state !== "failed" && (
        <Button size="sm" variant="secondary" full className="mt-3" onClick={onMatch}>
          <Link2 className="size-4" />
          Match to an order
        </Button>
      )}
    </div>
  );
}

/** Ranks open orders by how close they are to the payment. Always explainable. */
function suggestions(payment: Payment, orders: ReturnType<typeof useStore>["db"]["orders"]) {
  return orders
    .filter((o) => o.paymentStatus !== "paid" && o.status !== "cancelled")
    .map((order) => {
      const total = orderTotal(order);
      const amountMatch = 1 - Math.min(1, Math.abs(total - payment.amount) / Math.max(total, 1));
      const customerMatch = payment.customerId && payment.customerId === order.customerId ? 1 : 0;
      const hours = Math.abs(+new Date(payment.receivedAt) - +new Date(order.createdAt)) / 3600000;
      const timeMatch = Math.max(0, 1 - hours / 72);
      const score = amountMatch * 0.55 + customerMatch * 0.3 + timeMatch * 0.15;
      const reasons: string[] = [];
      if (Math.abs(total - payment.amount) < 1) reasons.push("Exact amount");
      else if (amountMatch > 0.9) reasons.push("Amount is close");
      if (customerMatch) reasons.push("Same customer");
      if (timeMatch > 0.7) reasons.push("Around the same time");
      return { order, score, total, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function MatchSheet({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const { db, matchPayment, dismissPayment } = useStore();
  const toast = useToast();
  const ranked = suggestions(payment, db.orders);

  return (
    <Sheet
      open
      onClose={onClose}
      title="Match this payment"
      description={`${money(payment.amount)} from ${payment.customerName}${payment.reference ? ` · ${payment.reference}` : ""}`}
      size="lg"
      footer={
        <Button
          variant="ghost"
          full
          onClick={() => {
            dismissPayment(payment.id);
            onClose();
            toast("Payment dismissed.", "info");
          }}
        >
          <X className="size-4" />
          Not a business payment
        </Button>
      }
    >
      <div className="space-y-2.5 pb-4">
        {ranked.map(({ order, score, total, reasons }, index) => {
          const customer = customerOf(db, order);
          return (
            <button
              key={order.id}
              onClick={() => {
                matchPayment(payment.id, order.id);
                onClose();
                toast(`Matched to ${order.code}.`);
              }}
              className="w-full rounded-2xl border border-border-subtle bg-surface p-3.5 text-left transition-colors hover:bg-surface-hover"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold">{customer?.name}</p>
                  <p className="tabular mt-0.5 text-[12px] text-text-secondary">
                    {order.code} · {relativeTime(order.createdAt)}
                  </p>
                </div>
                <p className="tabular shrink-0 text-[15px] font-bold">{money(total)}</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {index === 0 && score > 0.7 && (
                  <Badge tone="ai">
                    <Sparkles className="size-3" />
                    Suggested match
                  </Badge>
                )}
                {reasons.map((reason) => (
                  <Badge key={reason}>{reason}</Badge>
                ))}
                <ConfidenceMeter value={score} className="ml-auto" />
              </div>
            </button>
          );
        })}
        {!ranked.length && (
          <p className="py-6 text-center text-[13px] text-text-secondary">
            No open orders to match against.
          </p>
        )}
      </div>
    </Sheet>
  );
}

function RecordPaymentSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { db, recordPayment } = useStore();
  const toast = useToast();
  const [step, setStep] = useState<"amount" | "details">("amount");
  const [orderId, setOrderId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("mpesa");
  const [reference, setReference] = useState("");

  const order = db.orders.find((o) => o.id === orderId);
  const customer = order ? customerOf(db, order) : undefined;
  const value = Number(amount) || 0;

  const close = () => {
    setStep("amount");
    setOrderId("");
    setAmount("");
    setReference("");
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Record a payment"
      description={
        step === "amount"
          ? "How much came in?"
          : "Where it came from, so the ledger reconciles itself."
      }
      size="lg"
      footer={
        step === "amount" ? (
          <Button full size="lg" disabled={value <= 0} onClick={() => setStep("details")}>
            Continue · {money(value)}
          </Button>
        ) : (
          <div className="flex gap-2.5">
            <Button variant="secondary" onClick={() => setStep("amount")}>
              Back
            </Button>
            <Button
              full
              size="lg"
              onClick={() => {
                recordPayment({
                  orderId: orderId || undefined,
                  customerId: order?.customerId,
                  customerName: customer?.name ?? "Walk-in customer",
                  method,
                  amount: value,
                  reference: reference.trim(),
                });
                close();
                toast("Payment received.");
              }}
            >
              Record {money(value)}
            </Button>
          </div>
        )
      }
    >
      {step === "amount" ? (
        <div className="pb-4 pt-2">
          <AmountKeypad
            value={amount}
            onChange={setAmount}
            quickAmounts={[500, 1000, 2500, 5000, 10000]}
          />
        </div>
      ) : (
        <div className="space-y-4 pb-4">
          <Field label="Method">
            <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {Object.entries(methodLabel).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Order"
            hint="Leave empty and you can match it later from the payments list."
          >
            <Select value={orderId} onChange={(e) => setOrderId(e.target.value)}>
              <option value="">No order yet</option>
              {db.orders
                .filter((o) => o.paymentStatus !== "paid" && o.status !== "cancelled")
                .slice(0, 60)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.code} · {customerOf(db, o)?.name} · {money(orderTotal(o))}
                  </option>
                ))}
            </Select>
          </Field>

          {method === "mpesa" && (
            <Field label="M-Pesa code" hint="The confirmation code from the SMS.">
              <Input
                placeholder="QK73H2MN9P"
                value={reference}
                onChange={(e) => setReference(e.target.value.toUpperCase())}
              />
            </Field>
          )}

          {order && (
            <div className="flex items-center gap-2 rounded-2xl bg-success-soft p-3.5 text-[13px] text-success-text">
              <Check className="size-4 shrink-0" strokeWidth={2.5} />
              This will settle {order.code} for {customer?.name}.
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}
