"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page";
import { Hydrated } from "@/components/ui/hydrated";
import { SokoMark } from "@/components/soko-mark";
import { useStore } from "@/lib/store";
import { moreNav } from "@/lib/nav";
import { cn } from "@/lib/cn";
import { needsReviewCount } from "@/lib/selectors";

const moduleTints = [
  "bg-badge-3-bg text-badge-3-fg",
  "bg-badge-1-bg text-badge-1-fg",
  "bg-badge-4-bg text-badge-4-fg",
  "bg-badge-2-bg text-badge-2-fg",
  "bg-brand-soft text-brand-soft-text",
  "bg-ai-soft text-ai-text",
  "bg-delivery-soft text-delivery-text",
  "bg-surface-sunken text-text-secondary",
];

export default function MorePage() {
  return (
    <Hydrated>
      <MoreScreen />
    </Hydrated>
  );
}

function MoreScreen() {
  const { db } = useStore();
  const badges = { review: needsReviewCount(db), inbox: 0, openOrders: 0 };

  return (
    <>
      <PageHeader title="More" subtitle="Every part of your business operation." />

      <div className="mb-5 flex items-center gap-3 rounded-card border border-border-subtle bg-surface p-4 shadow-card">
        <SokoMark className="size-11" />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold">{db.business.name}</p>
          <p className="truncate text-[12px] text-text-secondary">
            {db.business.owner} · Till {db.business.tillNumber}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-border-subtle bg-surface shadow-card">
        {moreNav.map((item, i) => {
          const count = item.badge ? badges[item.badge] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3.5 p-4 transition-colors hover:bg-surface-hover ${
                i > 0 ? "border-t border-border-subtle" : ""
              }`}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-xl",
                  moduleTints[i % moduleTints.length],
                )}
              >
                <item.icon className="size-[18px]" strokeWidth={2.1} />
              </span>
              <span className="flex-1 text-[15px] font-semibold">{item.label}</span>
              {count > 0 && (
                <span className="tabular rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-brand-ink">
                  {count}
                </span>
              )}
              <ChevronRight className="size-4 text-text-muted" />
            </Link>
          );
        })}
      </div>

      <p className="mt-6 text-center text-[11px] text-text-muted">
        SokoOS · Every sale. One place.
      </p>
    </>
  );
}
