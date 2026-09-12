"use client";

import { useState } from "react";
import { LifeBuoy, MessageCircleQuestion } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { fileTicket, supportAvailable } from "@/lib/sync/support";

/**
 * A seller's one way to reach a human at SokoOS.
 *
 * Gated the same way M-Pesa and cloud sync are: a ticket has to land
 * somewhere, and there is nowhere for it to go from a device that has never
 * enrolled in cloud sync.
 */
export function SupportCard() {
  const available = supportAvailable();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"urgent" | "high" | "normal" | "low">("normal");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  function close() {
    setOpen(false);
    setTimeout(() => {
      setSent(false);
      setSubject("");
      setMessage("");
      setPriority("normal");
    }, 200);
  }

  async function submit() {
    if (!subject.trim() || !message.trim()) {
      toast("A subject and a message are both needed.", "info");
      return;
    }
    setSending(true);
    try {
      await fileTicket({ subject, message, priority });
      setSent(true);
    } catch (error) {
      toast((error as Error).message || "Couldn't send that. Try again.", "error");
    } finally {
      setSending(false);
    }
  }

  if (!available) {
    return (
      <Card className="mb-5 p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-sunken text-text-secondary">
            <LifeBuoy className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">Support needs cloud sync</p>
            <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
              This device is not signed in to a SokoOS account, so there is nowhere to send a
              ticket to. Turn on Cloud sync above, then a ticket reaches SokoOS directly.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="mb-5 p-4">
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-3 text-left"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-soft-text">
            <MessageCircleQuestion className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold">Contact support</span>
            <span className="block text-[12px] text-text-secondary">
              Raise something with SokoOS — a bug, a question, anything stuck.
            </span>
          </span>
        </button>
      </Card>

      <Sheet open={open} onClose={close} title="Contact support">
        {sent ? (
          <div className="py-6 text-center">
            <p className="text-[15px] font-semibold">Sent.</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">
              SokoOS staff can see this against your business account and will follow up.
            </p>
            <Button className="mt-5 w-full" onClick={close}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            <Field label="Subject">
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="What's this about?"
              />
            </Field>
            <Field label="Message">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="As much detail as you can give…"
              />
            </Field>
            <Field label="How urgent is this?">
              <Select
                value={priority}
                onChange={(e) => setPriority(e.target.value as typeof priority)}
              >
                <option value="low">Not urgent</option>
                <option value="normal">Normal</option>
                <option value="high">High — this is blocking me</option>
                <option value="urgent">Urgent — money or customers affected</option>
              </Select>
            </Field>
            <Button className="w-full" onClick={submit} disabled={sending}>
              {sending ? "Sending…" : "Send"}
            </Button>
          </div>
        )}
      </Sheet>
    </>
  );
}
