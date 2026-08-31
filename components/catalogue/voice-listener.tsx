"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Keyboard, Mic, Square } from "lucide-react";
import { Field, Textarea } from "@/components/ui/field";
import {
  readSpeechLanguage,
  speechLanguages,
  speechSupported,
  writeSpeechLanguage,
  type SpeechLanguage,
} from "@/lib/speech";
import { cn } from "@/lib/cn";

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

function noSubscribe() {
  return () => {};
}

/**
 * The microphone, and the language it listens in.
 *
 * Recognition itself belongs to the browser, so what it hears depends on the
 * phone in the seller's hand. The parsing underneath is ours and handles
 * English, Kiswahili and the Sheng that belongs to neither — which means a
 * Swahili sentence typed on a phone whose recognition only speaks English
 * still comes out right. Typing is not a fallback of last resort here; it is
 * the same path entered a different way.
 */
export function VoiceListener({
  placeholder,
  transcript,
  onTranscript,
  hint,
}: {
  placeholder?: string;
  transcript: string;
  onTranscript: (text: string) => void;
  hint?: string;
}) {
  const detected = useSyncExternalStore(noSubscribe, speechSupported, () => true);
  // Read on the client only, so the prerender and the hydrate agree.
  const stored = useSyncExternalStore(noSubscribe, readSpeechLanguage, () => "en-KE" as const);
  const [chosen, setChosen] = useState<SpeechLanguage | null>(null);
  const language = chosen ?? stored;
  const [forcedTyping, setForcedTyping] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setInterim("");
  }, []);

  useEffect(() => () => stop(), [stop]);

  const listen = () => {
    const Ctor =
      (window as unknown as { SpeechRecognition?: RecognitionCtor }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: RecognitionCtor }).webkitSpeechRecognition;

    if (!Ctor) {
      setForcedTyping(true);
      return;
    }

    const recognition = new Ctor();
    recognition.lang = language;
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
      if (settled) onTranscript(`${transcript} ${settled}`.trim());
      setInterim(pending);
    };
    recognition.onerror = (event) => {
      setError(
        event.error === "not-allowed"
          ? "The microphone was not allowed. Type it instead."
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

  const typing = forcedTyping || !detected;
  const current = speechLanguages.find((l) => l.code === language) ?? speechLanguages[0];

  return (
    <div className="space-y-3">
      {/* The language is a first-class choice, not a setting buried elsewhere. */}
      <div className="flex gap-2">
        {speechLanguages.map((option) => (
          <button
            key={option.code}
            onClick={() => {
              setChosen(option.code);
              writeSpeechLanguage(option.code);
              if (listening) stop();
            }}
            aria-pressed={language === option.code}
            className={cn(
              "h-9 flex-1 rounded-full border text-[13px] font-semibold transition-colors",
              language === option.code
                ? "border-transparent bg-brand text-brand-ink"
                : "border-border bg-surface text-text-secondary hover:bg-surface-hover",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {!typing ? (
        <div className="flex flex-col items-center py-1">
          <button
            onClick={listening ? stop : listen}
            aria-label={listening ? "Stop listening" : "Start listening"}
            className={cn(
              "relative flex size-20 items-center justify-center rounded-full transition-transform active:scale-95",
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
              <Square className="relative size-7 fill-current" strokeWidth={0} />
            ) : (
              <Mic className="relative size-8" strokeWidth={2} />
            )}
          </button>
          <p className="mt-2.5 text-[13px] font-semibold">
            {listening ? "Listening — tap to stop" : `Tap and say it in ${current.label}`}
          </p>
          <p className="mt-1 max-w-xs text-center text-[11px] leading-relaxed text-text-muted">
            {hint ?? `e.g. “${current.hint}”`}
          </p>
          <button
            onClick={() => setForcedTyping(true)}
            className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-text-secondary hover:text-text"
          >
            <Keyboard className="size-3.5" />
            Type it instead
          </button>
        </div>
      ) : (
        <Field
          label="Say it in your own words"
          hint={
            detected
              ? "The same sentence, typed. English or Kiswahili — both are understood."
              : "This browser will not let a web page listen, so type it. Everything after this works the same."
          }
        >
          <Textarea
            rows={3}
            autoFocus
            placeholder={placeholder ?? current.hint}
            value={transcript}
            onChange={(e) => onTranscript(e.target.value)}
          />
        </Field>
      )}

      {interim && (
        <p className="rounded-2xl bg-surface-sunken px-3.5 py-2.5 text-[13px] text-text-muted">
          {interim}
        </p>
      )}

      {error && (
        <p className="rounded-2xl bg-danger-soft p-3.5 text-[13px] leading-relaxed text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}
