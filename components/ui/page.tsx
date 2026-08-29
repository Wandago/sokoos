"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/cn";

export function PageHeader({
  title,
  subtitle,
  action,
  back,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  back?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div className={cn("mb-5", className)}>
      {back && (
        <Link
          href={back.href}
          className="-ml-1.5 mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-text-secondary hover:text-text"
        >
          <ChevronLeft className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.03em]">{title}</h1>
          {subtitle && (
            <div className="mt-1 text-[13px] leading-relaxed text-text-secondary">{subtitle}</div>
          )}
        </div>
        {action && <div className="shrink-0 pt-1">{action}</div>}
      </div>
    </div>
  );
}

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-center justify-between gap-3", className)}>
      <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-text-secondary">
        {children}
      </h2>
      {action}
    </div>
  );
}
