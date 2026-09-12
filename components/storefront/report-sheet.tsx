"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Field, Select, Textarea, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { fileStoreReport, type ReportReason } from "@/lib/storefront";

const reasons: { value: ReportReason; label: string }[] = [
  { value: "counterfeit", label: "Selling fakes or counterfeits" },
  { value: "scam", label: "Took payment, never delivered" },
  { value: "offensive", label: "Offensive content" },
  { value: "impersonation", label: "Impersonating another business" },
  { value: "other", label: "Something else" },
];

/**
 * The one entry point a customer has to flag a shop, from the shop itself —
 * the same page SokoOS has no other way of hearing from someone who does not,
 * and should not need to, have an account.
 */
export function ReportStoreLink({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("scam");
  const [detail, setDetail] = useState("");
  const [contact, setContact] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const toast = useToast();

  async function submit() {
    if (!detail.trim()) {
      toast("Say what's wrong.", "info");
      return;
    }
    setSending(true);
    try {
      await fileStoreReport(slug, { reason, detail, contact: contact || undefined });
      setSent(true);
    } catch (error) {
      toast((error as Error).message || "Couldn't send that. Try again.", "error");
    } finally {
      setSending(false);
    }
  }

  function close() {
    setOpen(false);
    setTimeout(() => {
      setSent(false);
      setDetail("");
      setContact("");
      setReason("scam");
    }, 200);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mx-auto flex items-center gap-1.5 py-6 text-[12px] font-medium text-text-muted hover:text-text-secondary"
      >
        <Flag className="size-3.5" />
        Report this shop
      </button>

      <Sheet open={open} onClose={close} title="Report this shop">
        {sent ? (
          <div className="py-6 text-center">
            <p className="text-[15px] font-semibold">Thanks — we&apos;ve got it.</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">
              SokoOS reviews every report against the business&apos;s account, not just this page.
            </p>
            <Button className="mt-5 w-full" onClick={close}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            <Field label="What's wrong">
              <Select value={reason} onChange={(e) => setReason(e.target.value as ReportReason)}>
                {reasons.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Details" hint="What happened, and when.">
              <Textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="Tell us what happened…"
              />
            </Field>
            <Field label="Your contact (optional)" hint="Only if you want us to follow up with you.">
              <Input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Phone or email"
              />
            </Field>
            <Button className="w-full" onClick={submit} disabled={sending}>
              {sending ? "Sending…" : "Send report"}
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}
