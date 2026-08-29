"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";

/** The "…" affordance the reference cards carry, wired to a real destination. */
export function CardMenu({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-full text-current opacity-60 transition-opacity hover:opacity-100",
        className,
      )}
    >
      <MoreHorizontal className="size-4" />
    </Link>
  );
}
