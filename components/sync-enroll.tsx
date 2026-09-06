"use client";

import { useState } from "react";
import { ArrowRight, Check, CloudUpload, Loader2 } from "lucide-react";
import { Card, Divider } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import {
  createTenant,
  requestCode,
  syncConfigured,
  verifyCode,
  getSession,
  setSession,
} from "@/lib/sync/client";
import { syncNow } from "@/lib/sync/runner";

/**
 * The one door into a real server session, for a device that only has a
 * local account so far.
 *
 * Sign-up and sign-in on this build are entirely local — nothing about them
 * talks to the API, which is deliberate for a business that just wants to
 * try the app. But the till, and syncing to a second device, need a real
 * account on the server, and until now nothing in the app ever asked for
 * one. This is that ask, kept small and out of the way: a phone number and
 * the code sent to it, which is the same identity check every seller here
 * already trusts.
 */
type Step = "closed" | "phone" | "code";

export function SyncEnroll() {
  const { db } = useStore();
  const toast = useToast();
  const [step, setStep] = useState<Step>("closed");
  const [phone, setPhone] = useState(db.account?.phone ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [enrolled] = useState(() => Boolean(getSession()));

  if (!syncConfigured()) return null;

  if (enrolled) {
    return (
      <Card className="mb-5 flex items-center gap-3 p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success-text">
          <Check className="size-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold">Cloud sync is on</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-text-secondary">
            This device has a real account on the server, so the till and a second device both
            work now.
          </p>
        </div>
      </Card>
    );
  }

  const sendCode = async () => {
    setError("");
    if (phone.replace(/\D/g, "").length < 9) return setError("That doesn't look like a phone number.");
    setBusy(true);
    try {
      await requestCode(phone);
      setStep("code");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async () => {
    setError("");
    if (code.trim().length !== 6) return setError("The code is 6 digits.");
    setBusy(true);
    try {
      const verified = await verifyCode(phone, code.trim(), db.account?.name);
      const tenant =
        verified.tenants[0] ?? (await createTenant(verified.token, db.business.name, db.business.industry));
      setSession({
        token: verified.token,
        accountId: verified.accountId,
        tenantId: tenant.id,
        tenantName: tenant.name,
        slug: tenant.slug,
      });
      // Everything already on this device goes up first, on the very sync
      // that just gained somewhere to send it to.
      syncNow(() => db);
      toast("Cloud sync is on. This device now has a real account.");
      // A reload rather than local state: the till card and every other
      // screen that checks for a session read it fresh on mount, not from a
      // context this component has no way to notify.
      window.location.reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (step === "closed") {
    return (
      <Card className="mb-5 p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-sunken text-text-secondary">
            <CloudUpload className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">Enable cloud sync</p>
            <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
              Connecting a till and syncing to a second device both need a real account on the
              server. This adds one to this business, using your phone number.
            </p>
          </div>
        </div>
        <Button variant="secondary" full className="mt-4" onClick={() => setStep("phone")}>
          Enable cloud sync
        </Button>
      </Card>
    );
  }

  return (
    <Card className="mb-5 p-4">
      <p className="text-[14px] font-semibold">Enable cloud sync</p>

      {step === "phone" && (
        <div className="mt-3.5 space-y-3">
          <Field label="Phone number" error={error || undefined}>
            <Input
              inputMode="tel"
              placeholder="0722 000 145"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setError("");
              }}
            />
          </Field>
          <div className="flex gap-2.5">
            <Button variant="ghost" onClick={() => setStep("closed")}>
              Cancel
            </Button>
            <Button full onClick={sendCode} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              Send code
            </Button>
          </div>
        </div>
      )}

      {step === "code" && (
        <div className="mt-3.5 space-y-3">
          <p className="text-[12px] leading-relaxed text-text-muted">
            A 6-digit code was sent to {phone}. Text messages aren&rsquo;t wired up on this build
            yet, so for now the code is only written to the API&rsquo;s server logs — open the
            deployment&rsquo;s logs on Vercel and look for a line starting with{" "}
            <code className="rounded bg-surface-sunken px-1 py-0.5">[sms]</code>.
          </p>
          <Divider />
          <Field label="6-digit code" error={error || undefined}>
            <Input
              inputMode="numeric"
              autoFocus
              placeholder="000000"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                setError("");
              }}
            />
          </Field>
          <div className="flex gap-2.5">
            <Button variant="ghost" onClick={() => setStep("phone")}>
              Back
            </Button>
            <Button full onClick={confirmCode} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Confirm
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
