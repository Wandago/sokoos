"use client";

import { BadgeCheck, Copy, Printer, ShieldQuestion, Share2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useStore, toWhatsApp } from "@/lib/store";
import { buildReceipt, methodName, receiptText, totalSpent } from "@/lib/receipts";
import { clockTime, fullDate, money } from "@/lib/format";
import type { Payment } from "@/lib/types";
import { cn } from "@/lib/cn";

/**
 * The receipt, as the customer will see it.
 *
 * Built around one line: what the person holding this can check, and how. When
 * there is an M-Pesa code that line is a green block with the code set large
 * enough to read off a cracked screen across a counter. When there is not, the
 * same block is neutral and says plainly that this is the seller's own record —
 * because a receipt that looks equally official either way teaches people that
 * looking official means nothing.
 */
export function ReceiptSheet({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const { db } = useStore();
  const toast = useToast();
  const receipt = buildReceipt(db, payment);
  const text = receiptText(receipt);
  const checkable = receipt.proof.checkable;

  const send = () => {
    const to = receipt.payerPhone ? toWhatsApp(receipt.payerPhone) : "";
    window.open(`https://wa.me/${to}?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Receipt"
      description={`${money(receipt.paid)} from ${receipt.payerName}`}
      size="lg"
      footer={
        <div className="flex gap-2">
          <Button full onClick={send}>
            <Share2 className="size-4" />
            Send on WhatsApp
          </Button>
          <Button
            variant="secondary"
            aria-label="Copy receipt"
            onClick={() =>
              navigator.clipboard?.writeText(text).then(
                () => toast("Receipt copied."),
                () => toast("Could not copy — select the text by hand.", "info"),
              )
            }
          >
            <Copy className="size-4" />
          </Button>
          <Button variant="secondary" aria-label="Print receipt" onClick={() => window.print()}>
            <Printer className="size-4" />
          </Button>
        </div>
      }
    >
      <div className="pb-4">
        <article className="receipt-paper overflow-hidden rounded-3xl border border-border-subtle bg-surface">
          {/* ---- The proof, first, because it is the point ---------------- */}
          <div
            className={cn(
              "px-5 pb-5 pt-5",
              checkable ? "bg-brand text-brand-ink" : "bg-surface-sunken text-text",
            )}
          >
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em]">
              {checkable ? (
                <BadgeCheck className="size-3.5" strokeWidth={2.6} />
              ) : (
                <ShieldQuestion className="size-3.5" strokeWidth={2.6} />
              )}
              {checkable ? "You can check this" : "Seller's own record"}
            </div>

            <p
              className={cn(
                "tabular mt-2 break-all text-[30px] font-extrabold leading-none tracking-[-0.03em]",
                !checkable && "text-[22px]",
              )}
            >
              {receipt.number}
            </p>

            <p
              className={cn(
                "mt-2.5 text-[12px] leading-relaxed",
                checkable ? "text-brand-ink/75" : "text-text-secondary",
              )}
            >
              {receipt.proof.line}
            </p>
          </div>

          {/* Torn from its stub. The notches do the work a scalloped edge
              cannot here: the paper is the same colour on both sides of the
              fold, so only a shape that breaks the outline reads as a tear. */}
          <div className="receipt-notch" aria-hidden />
          <div className="receipt-perf" aria-hidden />

          <div className="px-5 py-4">
            <p className="text-[15px] font-extrabold tracking-tight">{receipt.business.name}</p>
            <p className="mt-0.5 text-[12px] text-text-secondary">
              {receipt.business.tillNumber ? `Till ${receipt.business.tillNumber} · ` : ""}
              {receipt.business.phone}
            </p>

            <dl className="mt-3.5 space-y-1 text-[12px]">
              <Row label="Paid" value={`${fullDate(receipt.paidAt)}, ${clockTime(receipt.paidAt)}`} />
              <Row label="From" value={receipt.payerName} />
              {receipt.orderCode && <Row label="Order" value={receipt.orderCode} />}
              <Row label="Method" value={methodName(receipt.method)} />
            </dl>

            <div className="my-4 border-t border-dashed border-border" />

            <ul className="space-y-2">
              {receipt.lines.map((line, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 text-[13px]">
                    {line.qty > 1 && (
                      <span className="tabular mr-1.5 font-semibold text-text-secondary">
                        {line.qty}×
                      </span>
                    )}
                    {line.label}
                    {/* The asking price, struck through. A customer who
                        negotiated wants to see it, and a receipt that quietly
                        drops the number invites the question of whether the
                        right price was charged at all. */}
                    {line.listPrice && (
                      <span className="tabular ml-1.5 text-[12px] text-text-muted line-through">
                        {money(line.listPrice)}
                      </span>
                    )}
                  </span>
                  <span className="tabular shrink-0 text-[13px] font-semibold">
                    {money(line.total)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="my-4 border-t border-dashed border-border" />

            <dl className="space-y-1.5 text-[13px]">
              {receipt.bargained > 0 && (
                <div className="flex items-baseline justify-between gap-3 text-success-text">
                  <dt className="font-semibold">You saved</dt>
                  <dd className="tabular font-bold">{money(receipt.bargained)}</dd>
                </div>
              )}
              {receipt.discount > 0 && (
                <Row label="Discount" value={money(-receipt.discount)} />
              )}
              {receipt.deliveryCharged > 0 && (
                <Row label="Delivery" value={money(receipt.deliveryCharged)} />
              )}
              <div className="flex items-baseline justify-between gap-3 pt-1">
                <dt className="text-[15px] font-bold">Paid</dt>
                <dd className="tabular text-[20px] font-extrabold tracking-[-0.02em]">
                  {money(receipt.paid)}
                </dd>
              </div>
              {receipt.balance > 0 && (
                <div className="flex items-baseline justify-between gap-3 text-pending-text">
                  <dt className="text-[13px] font-semibold">Still to pay</dt>
                  <dd className="tabular text-[13px] font-bold">{money(receipt.balance)}</dd>
                </div>
              )}
            </dl>

            {/* The fare the seller never touched. Shown so the customer's own
                arithmetic works, and labelled so this receipt is not read as a
                claim on money that went straight to the rider. */}
            {receipt.riderPaidSeparately > 0 && (
              <div className="mt-4 rounded-2xl bg-surface-sunken p-3">
                <p className="text-[12px] leading-relaxed text-text-secondary">
                  Delivery{" "}
                  <span className="tabular font-semibold text-text">
                    {money(receipt.riderPaidSeparately)}
                  </span>{" "}
                  was paid straight to the rider at the door, so it is not on this receipt. You
                  spent{" "}
                  <span className="tabular font-semibold text-text">
                    {money(totalSpent(receipt))}
                  </span>{" "}
                  in total.
                </p>
              </div>
            )}
          </div>
        </article>
      </div>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="tabular text-right font-medium">{value}</dd>
    </div>
  );
}
