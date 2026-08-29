"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Check, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastTone = "success" | "info" | "error";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<{ toast: (message: string, tone?: ToastTone) => void } | null>(
  null,
);

const icons = {
  success: Check,
  info: Info,
  error: TriangleAlert,
};

const tones: Record<ToastTone, string> = {
  success: "bg-success-soft text-success-text",
  info: "bg-ai-soft text-ai-text",
  error: "bg-danger-soft text-danger-text",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {toasts.map((t) => {
          const Icon = icons[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              className="animate-rise pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-border-subtle bg-bg-elevated px-4 py-3 shadow-overlay"
            >
              <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", tones[t.tone])}>
                <Icon className="size-4" strokeWidth={2.5} />
              </span>
              <p className="text-sm font-medium">{t.message}</p>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx.toast;
}
