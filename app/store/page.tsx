"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { StorefrontView } from "@/components/storefront/templates";
import { ReportStoreLink } from "@/components/storefront/report-sheet";
import { Hydrated } from "@/components/ui/hydrated";
import { useStore } from "@/lib/store";
import { useQuery } from "@/lib/use-query";
import { fetchHostedStorefront, hostedStorefronts, visibleProducts } from "@/lib/storefront";
import type { Product, Storefront } from "@/lib/types";

export default function StorePage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg" />}>
      <Hydrated fallback={<div className="min-h-dvh bg-bg" />}>
        <Store />
      </Hydrated>
    </Suspense>
  );
}

type Remote =
  | { slug: string; status: "not-found" }
  | { slug: string; status: "ready"; storefront: Storefront; products: Product[] };

/**
 * The customer-facing mini site.
 *
 * On a hosted build with an address in the URL, this is the one page a
 * business's own local data must never leak into: a stranger opening
 * `/store?s=amina-beauty-bar` on their own phone has no local copy of Amina's
 * shop, so the real one is fetched from the server by slug. Only when there is
 * no API to ask, or no slug to ask it about — a plain build, or the seller's
 * own "View" button — does this fall back to the storefront held on this
 * device.
 */
function Store() {
  const { db } = useStore();
  const { get } = useQuery();
  const slug = get("s");
  const hosted = hostedStorefronts() && Boolean(slug);

  const [remote, setRemote] = useState<Remote | null>(null);

  useEffect(() => {
    if (!hosted || !slug) return;
    let cancelled = false;
    fetchHostedStorefront(slug)
      .then((data) => {
        if (!cancelled) setRemote({ slug, status: "ready", ...data });
      })
      .catch(() => {
        if (!cancelled) setRemote({ slug, status: "not-found" });
      });
    return () => {
      cancelled = true;
    };
  }, [hosted, slug]);

  if (hosted) {
    // A result for a different slug (or none yet) means this fetch is still
    // in flight — never show a stale shop while the real one loads.
    if (!remote || remote.slug !== slug) return <div className="min-h-dvh bg-bg" />;
    if (remote.status === "not-found") {
      return (
        <NotLive detail="It may have been unpublished, taken down, or the address is wrong." />
      );
    }
    return (
      <div className="min-h-dvh">
        <StorefrontView
          storefront={remote.storefront}
          products={visibleProducts(remote.products, remote.storefront)}
        />
        <ReportStoreLink slug={remote.storefront.slug} />
      </div>
    );
  }

  // No API configured, or no address given: show this device's own shop —
  // what the seller's own "View" button in the editor is for.
  if (!db.storefront.published) {
    return (
      <NotLive
        detail="The owner hasn't published it. If it's yours, publish it from the storefront editor."
        editorHref="/storefront"
      />
    );
  }

  return (
    <div className="min-h-dvh">
      <StorefrontView storefront={db.storefront} products={visibleProducts(db.products, db.storefront)} />
      <ReportStoreLink slug={db.storefront.slug} />
    </div>
  );
}

function NotLive({ detail, editorHref }: { detail: string; editorHref?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-bg px-6 text-center">
      <h1 className="text-[22px] font-extrabold tracking-tight">This shop is not live yet.</h1>
      <p className="max-w-sm text-[14px] leading-relaxed text-text-secondary">{detail}</p>
      {editorHref && (
        <Link
          href={editorHref}
          className="mt-2 inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-[14px] font-bold text-brand-ink"
        >
          <Pencil className="size-4" />
          Open the editor
        </Link>
      )}
    </div>
  );
}
