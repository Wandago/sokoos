"use client";

import { Suspense } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { StorefrontView } from "@/components/storefront/templates";
import { Hydrated } from "@/components/ui/hydrated";
import { useStore } from "@/lib/store";
import { useQuery } from "@/lib/use-query";

export default function StorePage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" />}>
      <Hydrated fallback={<div className="min-h-dvh bg-bg" />}>
        <Store />
      </Hydrated>
    </Suspense>
  );
}

/**
 * The customer-facing mini site.
 *
 * With no backend there is nothing to resolve a slug against, so this renders
 * the storefront held on this device — which is exactly what the seller needs
 * to see. A hosted build looks the slug up and renders the same components
 * with someone else's data.
 */
function Store() {
  const { db } = useStore();
  const { get } = useQuery();
  const slug = get("s");
  const mismatch = slug !== null && slug !== db.storefront.slug;

  if (!db.storefront.published) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
        <h1 className="text-[22px] font-extrabold tracking-tight">This shop is not live yet.</h1>
        <p className="max-w-sm text-[14px] leading-relaxed text-text-secondary">
          The owner hasn&apos;t published it. If it&apos;s yours, publish it from the storefront
          editor.
        </p>
        <Link
          href="/storefront"
          className="mt-2 inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-[14px] font-bold text-brand-ink"
        >
          <Pencil className="size-4" />
          Open the editor
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      {mismatch && (
        <p className="bg-panel px-4 py-2 text-center text-[12px] text-panel-muted">
          Showing the shop saved on this device. A hosted build resolves{" "}
          <span className="font-semibold text-brand">/{slug}</span> on the server.
        </p>
      )}
      <StorefrontView storefront={db.storefront} products={db.products} />
    </div>
  );
}
