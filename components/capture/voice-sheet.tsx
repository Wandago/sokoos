"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Keyboard, Mic, Square } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { parseSpoken, speechSupported } from "@/lib/speech";
import { newId } from "@/lib/id";
import { money } from "@/lib/format";
import { cn } from "@/lib/cn";
import { DirectionVerdictCard } from "./direction-verdict";

/* The Web Speech API is not in lib.dom, so declare only what is used here. */
interface SpeechResultAlternative {
  transcript: string;
}
interface SpeechResult {
  0: SpeechResultAlternative;
  isFinal: boolean;
  length: number;
}
interface SpeechEvent {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechResult };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

const examples = [
  "I received three thousand five hundred from Grace for two dresses",
  "Paid eight thousand six hundred to Gikomba Millers for flour",
  "Bought packaging for 2k cash",
];

/**
 * Speaking a transaction. The microphone is the real Web Speech API where the
 * browser has it, and where it does not the same sentence can be typed — the
 * part that matters, turning the sentence into an amount and a direction, runs
 * identically either way.
 */
export function VoiceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addCapture } = useStore();
  const toast = useToast();
  const recognitionRef = useRef<Recognition | null>(null);

  // Read on the client only: the server has no idea what this browser can do.
  const detected = useSyncExternalStore(noSubscribe, speechSupported, () => true);
  const [forcedUnsupported, setForcedUnsupported] = useState(false);
  const supported = detected && !forcedUnsupported;
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [typing, setTyping] = useState(false);
  const [amountOverride, setAmountOverride] = useState("");

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setInterim("");
  }, []);

  const listen = () => {
    const Ctor = (
      window as unknown as {
        SpeechRecognition?: RecognitionCtor;
        webkitSpeechRecognition?: RecognitionCtor;
      }
    ).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition;

    if (!Ctor) {
      setForcedUnsupported(true);
      setTyping(true);
      return;
    }

    const recognition = new Ctor();
    // Kenyan English, so "shillings" and local names are heard properly.
    recognition.lang = "en-KE";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let settled = "";
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) settled += result[0].transcript;
        else pending += result[0].transcript;
      }
      if (settled) setTranscript((prev) => `${prev} ${settled}`.trim());
      setInterim(pending);
    };
    recognition.onerror = (event) => {
      setError(
        event.error === "not-allowed"
          ? "The microphone was not allowed. Type the sentence instead."
          : "We could not hear that. Try again, or type it.",
      );
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setError(null);
    setListening(true);
    recognition.start();
  };

  useEffect(() => () => stop(), [stop]);

  const heard = `${transcript} ${interim}`.trim();
  const parsed = parseSpoken(heard);
  const amount = amountOverride ? Number(amountOverride) : (parsed.amount ?? 0);

  const reset = () => {
    setTranscript("");
    setInterim("");
    setAmountOverride("");
    setError(null);
  };

  const close = () => {
    stop();
    reset();
    setTyping(false);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Say the transaction"
      description="Nothing is recorded — only the words are kept."
      size="lg"
      footer={
        heard ? (
          <Button
            full
            size="lg"
            disabled={amount <= 0}
            onClick={() => {
              stop();
              addCapture({
                id: newId("cap"),
                kind: parsed.verdict.direction === "credit" ? "mpesa_message" : "receipt",
                fileName: "spoken-entry",
                uploadedAt: new Date().toISOString(),
                status: parsed.verdict.confidence >= 0.8 && parsed.amount ? "confirmed" : "needs_review",
                confidence: parsed.verdict.confidence,
                via: "voice",
                direction: parsed.verdict.direction,
                directionReason: parsed.verdict.reason,
                transcript: heard,
                extracted: {
                  amount,
                  date: new Date().toISOString(),
                  merchant: parsed.verdict.direction === "debit" ? (parsed.party ?? undefined) : undefined,
                  customer: parsed.verdict.direction === "credit" ? (parsed.party ?? undefined) : undefined,
                  category: parsed.category,
                  method: parsed.method,
                },
              });
              close();
              toast(
                `${money(amount)} logged as money ${parsed.verdict.direction === "credit" ? "in" : "out"}.`,
              );
            }}
          >
            <Check className="size-4" strokeWidth={2.5} />
            Log {amount > 0 ? money(amount) : "it"}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4 pb-4">
        {supported && !typing ? (
          <div className="flex flex-col items-center py-2">
            <button
              onClick={listening ? stop : listen}
              aria-label={listening ? "Stop listening" : "Start listening"}
              className={cn(
                "relative flex size-24 items-center justify-center rounded-full transition-transform active:scale-95",
                listening ? "bg-danger text-white" : "bg-brand text-brand-ink",
              )}
            >
              {listening && (
                <>
                  <span className="absolute inset-0 animate-ping rounded-full bg-danger/40" />
                  <span className="absolute -inset-2 rounded-full border-2 border-danger/30" />
                </>
              )}
              {listening ? (
                <Square className="relative size-8 fill-current" strokeWidth={0} />
              ) : (
                <Mic className="relative size-9" strokeWidth={2} />
              )}
            </button>
            <p className="mt-3 text-[13px] font-semibold">
              {listening ? "Listening — tap to stop" : "Tap and say it"}
            </p>
            <button
              onClick={() => setTyping(true)}
              className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-text-secondary hover:text-text"
            >
              <Keyboard className="size-3.5" />
              Type it instead
            </button>
          </div>
        ) : (
          <Field
            label="Type what happened"
            hint={
              supported
                ? "The same sentence, typed."
                : "This browser will not let a web page listen, so type the sentence — everything after that works the same."
            }
          >
            <Textarea
              rows={3}
              autoFocus
              placeholder={examples[0]}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
            />
          </Field>
        )}

        {error && (
          <p className="rounded-2xl bg-danger-soft p-3.5 text-[13px] leading-relaxed text-danger-text">
            {error}
          </p>
        )}

        {heard ? (
          <>
            <div className="rounded-2xl border border-border-subtle bg-surface p-4">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-text-muted">
                What we heard
              </p>
              <p className="text-[15px] leading-relaxed">
                {transcript}
                {interim && <span className="text-text-muted"> {interim}</span>}
              </p>
              <button
                onClick={reset}
                className="mt-2.5 text-[12px] font-semibold text-text-secondary hover:text-text"
              >
                Start over
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <Understood label="Amount" value={parsed.amount ? money(parsed.amount) : "not heard"} missing={!parsed.amount} />
              <Understood label="Who" value={parsed.party ?? "not heard"} missing={!parsed.party} />
              <Understood label="Category" value={parsed.category} />
              <Understood
                label="Method"
                value={parsed.method ? parsed.method.toUpperCase() : "not said"}
                missing={!parsed.method}
              />
            </div>

            {!parsed.amount && (
              <Field label="We could not hear an amount" hint="Type it and the rest still stands.">
                <Input
                  prefix="KES"
                  inputMode="decimal"
                  placeholder="0"
                  value={amountOverride}
                  onChange={(e) => setAmountOverride(e.target.value.replace(/[^\d.]/g, ""))}
                />
              </Field>
            )}

            <DirectionVerdictCard verdict={parsed.verdict} amount={amount} />
          </>
        ) : (
          <div className="rounded-2xl bg-surface-sunken p-4">
            <p className="mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-text-secondary">
              Try saying
            </p>
            <div className="space-y-2">
              {examples.map((example) => (
                <button
                  key={example}
                  onClick={() => {
                    setTyping(true);
                    setTranscript(example);
                  }}
                  className="block w-full text-left text-[13px] leading-relaxed text-text-secondary hover:text-text"
                >
                  “{example}”
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** No store to subscribe to — the answer cannot change during a session. */
function noSubscribe() {
  return () => {};
}

function Understood({
  label,
  value,
  missing,
}: {
  label: string;
  value: string;
  missing?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface px-3.5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-muted">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate text-[14px] font-bold",
          missing ? "font-medium text-text-muted" : "",
        )}
      >
        {value}
      </p>
    </div>
  );
}
