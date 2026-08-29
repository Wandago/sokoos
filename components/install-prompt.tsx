"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { SokoMark } from "./soko-mark";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "sokoos.install-dismissed";

/**
 * Add to Home Screen. Chrome/Edge/Android fire beforeinstallprompt and we can
 * install in one tap; iOS Safari has no such API, so we show the Share-sheet
 * instructions instead.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const dismissed = (() => {
      try {
        return window.localStorage.getItem(DISMISS_KEY) === "1";
      } catch {
        return false;
      }
    })();
    if (dismissed) return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const isSafari =
      /safari/i.test(window.navigator.userAgent) && !/crios|fxios/i.test(window.navigator.userAgent);
    if (isIos && isSafari) {
      const timer = setTimeout(() => setShowIosHint(true), 2500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", onPrompt);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setDeferred(null);
    setShowIosHint(false);
  };

  if (!deferred && !showIosHint) return null;

  return (
    <div className="pb-safe fixed inset-x-0 bottom-20 z-50 px-4 lg:bottom-6 lg:left-auto lg:right-6 lg:w-96 lg:px-0">
      <div className="animate-rise flex items-start gap-3 rounded-2xl border border-border-subtle bg-bg-elevated p-4 shadow-overlay">
        <SokoMark className="size-10 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold">Install SokoOS</p>
          {deferred ? (
            <p className="mt-0.5 text-[12px] leading-relaxed text-text-secondary">
              Add it to your home screen and run your business offline.
            </p>
          ) : (
            <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[12px] leading-relaxed text-text-secondary">
              Tap <Share className="inline size-3.5" /> Share, then
              <span className="font-semibold text-text">Add to Home Screen</span>.
            </p>
          )}
          {deferred && (
            <button
              onClick={async () => {
                await deferred.prompt();
                await deferred.userChoice;
                dismiss();
              }}
              className="mt-2.5 inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3 text-[13px] font-semibold text-brand-ink hover:bg-brand-hover"
            >
              <Download className="size-4" />
              Install
            </button>
          )}
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 rounded-full p-1.5 text-text-muted hover:bg-surface-hover"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
