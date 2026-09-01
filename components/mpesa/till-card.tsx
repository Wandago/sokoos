"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { Card, Divider } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import {
  connectTill,
  fetchTill,
  registerTill,
  tillAvailable,
  type TillStatus,
} from "@/lib/sync/mpesa";
import { relativeTime } from "@/lib/format";

/**
 * Connecting a seller's own M-Pesa till.
 *
 * The sentence this whole screen exists to make true: the money still goes
 * straight to the seller. Nothing here puts SokoOS between a customer and a
 * till — the customer pays the same number they already pay, it lands in the
 * same account, at the same moment. What changes is that the payment shows up
 * in the books by itself instead of being read off an SMS and typed in.
 *
 * That is worth saying on the screen and not only in a commit message, because
 * a form asking for API credentials next to the word M-Pesa looks exactly like
 * the thing sellers are right to be suspicious of.
 */

type Draft = {
  kind: "paybill" | "till";
  shortcode: string;
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  environment: "sandbox" | "production";
};

const empty: Draft = {
  kind: "till",
  shortcode: "",
  consumerKey: "",
  consumerSecret: "",
  passkey: "",
  environment: "sandbox",
};

export function TillCard({ tillNumber }: { tillNumber?: string }) {
  const toast = useToast();
  const available = tillAvailable();

  const [status, setStatus] = useState<TillStatus | null>(null);
  const [loading, setLoading] = useState(available);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft>({ ...empty, shortcode: tillNumber ?? "" });

  useEffect(() => {
    if (!available) return;
    let live = true;
    fetchTill()
      .then((next) => live && setStatus(next))
      .catch(() => live && setStatus({ connected: false }))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [available]);

  /* Nothing to connect to. Rather than show a form that cannot work, say what
   * the app is doing instead — which is a real answer, not an apology: the
   * books still work, the payment is just typed rather than delivered. */
  if (!available) {
    return (
      <Card className="mb-5 p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-sunken text-text-secondary">
            <Link2 className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">M-Pesa payments arrive by hand</p>
            <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">
              This device is not signed in to a SokoOS account, so there is nowhere for Safaricom
              to send a confirmation. Payments still get into the books — record them as they come
              in, or import a statement at the end of the week and every transaction code you
              already have is skipped.
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-text-muted">
              Connecting a till never moves your money through SokoOS. Customers keep paying your
              own number, and it keeps landing in your own account.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="mb-5 flex items-center gap-2 p-4 text-[13px] text-text-secondary">
        <Loader2 className="size-4 animate-spin" />
        Checking your till…
      </Card>
    );
  }

  const connected = status?.connected && !editing;

  async function save() {
    if (!draft.shortcode.trim() || !draft.consumerKey.trim() || !draft.consumerSecret.trim()) {
      toast("The shortcode, consumer key and secret are all needed.", "info");
      return;
    }
    setBusy(true);
    try {
      const next = await connectTill({
        kind: draft.kind,
        shortcode: draft.shortcode.trim(),
        consumerKey: draft.consumerKey.trim(),
        consumerSecret: draft.consumerSecret.trim(),
        passkey: draft.passkey.trim() || undefined,
        environment: draft.environment,
      });
      setStatus(next);
      setEditing(false);
      // Cleared from memory the moment they are sent; they never come back down.
      setDraft({ ...empty, shortcode: next.shortcode ?? "" });
      toast("Till connected.");
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function register() {
    setBusy(true);
    try {
      await registerTill();
      setStatus(await fetchTill());
      toast("Safaricom will now send your payments here.");
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  if (connected && status) {
    return (
      <Card className="mb-5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">
              {status.kind === "paybill" ? "Paybill" : "Till"} {status.shortcode}
            </p>
            <p className="mt-0.5 text-[12px] text-text-secondary">
              Key {status.consumerKey} · {status.environment}
            </p>
          </div>
          {status.registeredAt ? (
            <Badge tone="success" dot>
              Listening
            </Badge>
          ) : (
            <Badge tone="pending" dot>
              Not registered
            </Badge>
          )}
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-text-secondary">
          Customers pay this number exactly as they do now, and the money lands in your account the
          same instant. SokoOS is only told that it happened, so the payment files itself.
        </p>

        <Divider className="my-3.5" />

        {status.lastEventAt ? (
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-success-text">
            <Check className="size-4" />
            Last payment received {relativeTime(status.lastEventAt)}
          </p>
        ) : (
          <p className="text-[13px] text-text-secondary">
            No payment has arrived yet. The first one to reach this till will prove the connection
            better than any test can.
          </p>
        )}

        {!status.registeredAt && (
          <div className="mt-3.5 space-y-3">
            <p className="text-[13px] leading-relaxed text-text-secondary">
              One step left: tell Safaricom where to send confirmations.
            </p>
            <Button full onClick={register} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              Register with Safaricom
            </Button>
            <p className="text-[12px] leading-relaxed text-text-muted">
              If your Daraja app registers URLs from the portal instead, paste these there.
            </p>
            <CallbackUrl label="Confirmation" url={status.confirmationUrl} />
            <CallbackUrl label="Validation" url={status.validationUrl} />
          </div>
        )}

        <Button variant="ghost" full className="mt-3" onClick={() => setEditing(true)}>
          <RefreshCw className="size-4" />
          Replace these credentials
        </Button>
      </Card>
    );
  }

  return (
    <Card className="mb-5 p-4">
      <p className="text-[15px] font-semibold">Connect your own till</p>
      <p className="mt-1 mb-4 text-[13px] leading-relaxed text-text-secondary">
        Create an app on the Safaricom Daraja portal for your own Paybill or Till and paste its
        keys here. They are encrypted before they are stored and are never shown again — not even
        to you. Your money does not pass through SokoOS at any point.
      </p>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kind">
            <Select
              value={draft.kind}
              onChange={(e) => setDraft({ ...draft, kind: e.target.value as Draft["kind"] })}
            >
              <option value="till">Buy Goods</option>
              <option value="paybill">Paybill</option>
            </Select>
          </Field>
          <Field label="Number">
            <Input
              inputMode="numeric"
              placeholder="174379"
              value={draft.shortcode}
              onChange={(e) => setDraft({ ...draft, shortcode: e.target.value.replace(/\D/g, "") })}
            />
          </Field>
        </div>

        <Field label="Consumer key">
          <Input
            autoComplete="off"
            spellCheck={false}
            value={draft.consumerKey}
            onChange={(e) => setDraft({ ...draft, consumerKey: e.target.value })}
          />
        </Field>

        <Field label="Consumer secret">
          <Input
            type="password"
            autoComplete="off"
            value={draft.consumerSecret}
            onChange={(e) => setDraft({ ...draft, consumerSecret: e.target.value })}
          />
        </Field>

        <Field
          label="Passkey"
          hint="Only needed if you want to send a payment request to a customer's phone. Leave it empty otherwise."
        >
          <Input
            type="password"
            autoComplete="off"
            value={draft.passkey}
            onChange={(e) => setDraft({ ...draft, passkey: e.target.value })}
          />
        </Field>

        <Field
          label="Environment"
          hint="Start on sandbox. Switch to live once a test payment has come through."
        >
          <Select
            value={draft.environment}
            onChange={(e) =>
              setDraft({ ...draft, environment: e.target.value as Draft["environment"] })
            }
          >
            <option value="sandbox">Sandbox</option>
            <option value="production">Live</option>
          </Select>
        </Field>

        <Button full onClick={save} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
          Connect till
        </Button>

        {editing && (
          <Button variant="ghost" full onClick={() => setEditing(false)}>
            Cancel
          </Button>
        )}
      </div>
    </Card>
  );
}

/** A URL long enough that nobody should have to retype it. */
function CallbackUrl({ label, url }: { label: string; url?: string }) {
  const toast = useToast();
  if (!url) return null;
  return (
    <div className="rounded-2xl bg-surface-sunken p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold text-text-secondary">{label} URL</span>
        <button
          className="flex items-center gap-1 text-[12px] font-semibold text-brand-soft-text"
          onClick={() => {
            navigator.clipboard?.writeText(url).then(
              () => toast("Copied."),
              () => toast("Could not copy — select it by hand.", "info"),
            );
          }}
        >
          <Copy className="size-3.5" />
          Copy
        </button>
      </div>
      <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-text-muted">{url}</p>
    </div>
  );
}
