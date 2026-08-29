"use client";

import { cn } from "@/lib/cn";

const control =
  "w-full rounded-2xl border border-border bg-surface px-3.5 text-[15px] text-text placeholder:text-text-muted transition-colors focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/20 disabled:opacity-60";

export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label?: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("block", className)}>
      {label && (
        <span className="mb-1.5 block text-[13px] font-semibold text-text-secondary">{label}</span>
      )}
      {children}
      {error ? (
        <span className="mt-1.5 block text-[12px] font-medium text-danger">{error}</span>
      ) : hint ? (
        <span className="mt-1.5 block text-[12px] text-text-muted">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input({
  className,
  prefix,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { prefix?: string }) {
  if (prefix) {
    return (
      <span className="flex items-stretch overflow-hidden rounded-2xl border border-border bg-surface transition-colors focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/20">
        <span className="flex items-center border-r border-border-subtle bg-surface-sunken px-3 text-[13px] font-semibold text-text-secondary">
          {prefix}
        </span>
        <input
          className={cn(
            "tabular h-12 min-w-0 flex-1 bg-transparent px-3.5 text-[15px] text-text placeholder:text-text-muted focus:outline-none",
            className,
          )}
          {...props}
        />
      </span>
    );
  }
  return <input className={cn(control, "h-12", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-24 py-3 leading-relaxed", className)} {...props} />;
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, "h-12 appearance-none bg-no-repeat pr-9", className)} {...props}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%2356675f' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundPosition: "right 0.75rem center",
      }}
    >
      {children}
    </select>
  );
}

export function SearchInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span className="relative block">
      <svg
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-text-muted"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        className={cn(control, "h-11 rounded-full pl-10 text-sm", className)}
        {...props}
      />
    </span>
  );
}
