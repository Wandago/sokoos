"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "./button";

/**
 * One overlay primitive for the whole app: a bottom sheet on phones,
 * a centred dialog from `sm` up. Large tap targets, drag affordance,
 * escape + backdrop to close.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  size?: "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="animate-fade absolute inset-0 bg-ink-950/40 backdrop-blur-[2px]"
        style={{ backgroundColor: "rgb(7 19 16 / 0.45)" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "animate-sheet relative flex max-h-[92vh] w-full flex-col rounded-t-sheet bg-bg-elevated shadow-overlay sm:animate-rise sm:max-h-[88vh] sm:rounded-sheet",
          size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg",
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-border sm:hidden" />
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight">{title}</h2>
            {description && (
              <p className="mt-0.5 text-[13px] text-text-secondary">{description}</p>
            )}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1">
            <X className="size-5" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">{children}</div>
        {footer && (
          <div className="pb-safe border-t border-border-subtle bg-bg-elevated px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Confirmation dialog for destructive or irreversible actions. */
export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = "Confirm",
  tone = "primary",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: string;
  confirmLabel?: string;
  tone?: "primary" | "danger";
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="pb-5 text-[15px] leading-relaxed text-text-secondary">{body}</p>
      <div className="pb-safe flex gap-3 pb-4">
        <button
          onClick={onClose}
          className="h-12 flex-1 rounded-xl border border-border bg-surface text-sm font-semibold hover:bg-surface-hover"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={cn(
            "h-12 flex-1 rounded-xl text-sm font-semibold text-white",
            tone === "danger" ? "bg-danger hover:bg-danger-hover" : "bg-brand hover:bg-brand-hover",
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
