"use client";

import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "ai";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 select-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-card hover:bg-brand-hover",
  secondary:
    "bg-surface text-text border border-border hover:bg-surface-hover hover:border-border-strong",
  ghost: "text-text-secondary hover:bg-surface-hover hover:text-text",
  danger: "bg-danger text-white hover:bg-danger-hover",
  ai: "bg-ai-soft text-ai-text border border-transparent hover:brightness-[0.97]",
};

// Minimum 44px tall on md+ — these are thumb targets on a phone.
const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-[13px]",
  md: "h-11 px-4 text-sm",
  lg: "h-13 px-5 text-[15px]",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  full,
  className,
  children,
  ...props
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], full && "w-full", className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  full,
  className,
  children,
}: CommonProps & { href: string }) {
  return (
    <Link
      href={href}
      className={cn(base, variants[variant], sizes[size], full && "w-full", className)}
    >
      {children}
    </Link>
  );
}

/** Circular icon button — used in headers and list rows. */
export function IconButton({
  label,
  className,
  children,
  ...props
}: { label: string; className?: string; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-hover hover:text-text active:scale-95",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
