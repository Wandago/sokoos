"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Layout,
  Palette as PaletteIcon,
  Pencil,
  Sparkles,
  Star,
} from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/ui/page";
import { Hydrated } from "@/components/ui/hydrated";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ListSkeleton } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { StorefrontView } from "@/components/storefront/templates";
import { useStore } from "@/lib/store";
import { useQuery } from "@/lib/use-query";
import { palettes, storefrontUrl, templates, visibleProducts } from "@/lib/storefront";
import { money } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { StorefrontPalette, StorefrontTemplate } from "@/lib/types";

export default function StorefrontPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Hydrated>
        <StorefrontEditor />
      </Hydrated>
    </Suspense>
  );
}

type Tab = "design" | "content" | "products";

function StorefrontEditor() {
  const { db, updateStorefront, toggleStorefrontProduct } = useStore();
  const { get } = useQuery();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("design");
  const [copied, setCopied] = useState(false);

  const storefront = db.storefront;
  const shown = visibleProducts(db.products, storefront);
  const justCreated = get("new") === "1";

  const copyLink = () => {
    navigator.clipboard?.writeText(`https://${storefrontUrl(storefront)}`).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      },
      () => toast("Couldn't copy the link.", "error"),
    );
  };

  return (
    <>
      <PageHeader
        title="Your mini site"
        subtitle="Everything you sell, on a page you can drop in your bio."
        action={
          <Link
            href="/store"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-panel px-4 text-[13px] font-semibold text-panel-text"
          >
            <ExternalLink className="size-3.5" />
            View
          </Link>
        }
      />

      {justCreated && (
        <Card className="mb-4 border-transparent bg-brand p-4 text-brand-ink">
          <div className="flex gap-3">
            <Sparkles className="mt-0.5 size-5 shrink-0" strokeWidth={2.3} />
            <div>
              <p className="text-[15px] font-bold">Your site is live.</p>
              <p className="mt-1 text-[13px] leading-relaxed opacity-80">
                Every product in SokoOS is already on it. Pick a look, then share the link.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Address + publish */}
      <Card className="mb-5 p-4">
        <p className="text-[12px] font-semibold text-text-secondary">Your address</p>
        <p className="mt-1 break-all text-[15px] font-bold tracking-tight">
          {storefrontUrl(storefront)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2.5">
          <Button size="sm" variant="secondary" onClick={copyLink}>
            {copied ? <Check className="size-4" strokeWidth={3} /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button
            size="sm"
            variant={storefront.published ? "secondary" : "primary"}
            onClick={() => {
              updateStorefront({ published: !storefront.published });
              toast(storefront.published ? "Site unpublished." : "Site published.");
            }}
          >
            {storefront.published ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {storefront.published ? "Unpublish" : "Publish"}
          </Button>
          <Badge tone={storefront.published ? "success" : "pending"} dot>
            {storefront.published ? "Live" : "Draft"}
          </Badge>
        </div>
      </Card>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
        <div className="min-w-0">
          <Segmented
            className="mb-4"
            value={tab}
            onChange={setTab}
            options={[
              { value: "design", label: "Design" },
              { value: "content", label: "Content" },
              { value: "products", label: "Products", count: shown.length },
            ]}
          />

          {tab === "design" && (
            <>
              <SectionTitle>
                <span className="inline-flex items-center gap-1.5">
                  <Layout className="size-3.5" />
                  Template
                </span>
              </SectionTitle>
              <div className="mb-6 grid gap-2.5 sm:grid-cols-2">
                {templates.map((template) => {
                  const active = storefront.template === template.id;
                  return (
                    <button
                      key={template.id}
                      onClick={() =>
                        updateStorefront({ template: template.id as StorefrontTemplate })
                      }
                      aria-pressed={active}
                      className={cn(
                        "rounded-card border p-3.5 text-left transition-colors",
                        active
                          ? "border-brand bg-brand-soft"
                          : "border-border-subtle bg-surface hover:bg-surface-hover",
                      )}
                    >
                      <TemplateThumb id={template.id as StorefrontTemplate} />
                      <div className="mt-3 flex items-center gap-2">
                        <p className="text-[14px] font-bold">{template.name}</p>
                        {active && <Check className="size-4 text-brand-text" strokeWidth={3} />}
                      </div>
                      <p className="mt-1 text-[12px] leading-relaxed text-text-secondary">
                        {template.description}
                      </p>
                      <p className="mt-1.5 text-[11px] font-semibold text-text-muted">
                        Best for {template.bestFor}
                      </p>
                    </button>
                  );
                })}
              </div>

              <SectionTitle>
                <span className="inline-flex items-center gap-1.5">
                  <PaletteIcon className="size-3.5" />
                  Colours
                </span>
              </SectionTitle>
              <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {Object.values(palettes).map((palette) => {
                  const active = storefront.palette === palette.id;
                  return (
                    <button
                      key={palette.id}
                      onClick={() =>
                        updateStorefront({ palette: palette.id as StorefrontPalette })
                      }
                      aria-pressed={active}
                      className={cn(
                        "rounded-card border p-3 text-left transition-colors",
                        active ? "border-brand" : "border-border-subtle hover:bg-surface-hover",
                      )}
                    >
                      <span className="flex gap-1.5">
                        {[palette.band, palette.accent, palette.bg, palette.surface].map(
                          (colour, i) => (
                            <span
                              key={i}
                              className="size-6 rounded-md ring-1 ring-inset ring-black/10"
                              style={{ background: colour }}
                            />
                          ),
                        )}
                      </span>
                      <span className="mt-2 flex items-center gap-1.5">
                        <span className="text-[13px] font-bold">{palette.name}</span>
                        {active && <Check className="size-3.5 text-brand-text" strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>

              <label className="flex items-center justify-between gap-4 rounded-card border border-border-subtle bg-surface p-4">
                <span>
                  <span className="block text-[14px] font-semibold">Show prices</span>
                  <span className="block text-[12px] text-text-secondary">
                    Turn this off if you quote per customer.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={storefront.showPrices}
                  onChange={(e) => updateStorefront({ showPrices: e.target.checked })}
                  className="size-5 accent-[--color-brand]"
                />
              </label>
            </>
          )}

          {tab === "content" && (
            <div className="space-y-4">
              <Field label="Shop name">
                <Input
                  value={storefront.headline}
                  onChange={(e) => updateStorefront({ headline: e.target.value })}
                />
              </Field>
              <Field label="One line about the business">
                <Input
                  value={storefront.tagline}
                  onChange={(e) => updateStorefront({ tagline: e.target.value })}
                />
              </Field>
              <Field label="Your story" hint="Shown in full on the Story template.">
                <Textarea
                  value={storefront.about}
                  onChange={(e) => updateStorefront({ about: e.target.value })}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="WhatsApp number" hint="Where orders land.">
                  <Input
                    inputMode="tel"
                    value={storefront.whatsapp}
                    onChange={(e) =>
                      updateStorefront({ whatsapp: e.target.value.replace(/\D/g, "") })
                    }
                  />
                </Field>
                <Field label="Location">
                  <Input
                    value={storefront.location}
                    onChange={(e) => updateStorefront({ location: e.target.value })}
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Instagram handle">
                  <Input
                    prefix="@"
                    value={storefront.instagram}
                    onChange={(e) => updateStorefront({ instagram: e.target.value.replace(/^@/, "") })}
                  />
                </Field>
                <Field label="TikTok handle">
                  <Input
                    prefix="@"
                    value={storefront.tiktok}
                    onChange={(e) => updateStorefront({ tiktok: e.target.value.replace(/^@/, "") })}
                  />
                </Field>
              </div>
              <Field label="Delivery note">
                <Input
                  value={storefront.deliveryNote}
                  onChange={(e) => updateStorefront({ deliveryNote: e.target.value })}
                />
              </Field>
            </div>
          )}

          {tab === "products" && (
            <>
              <p className="mb-3 text-[13px] leading-relaxed text-text-secondary">
                Your products come straight from SokoOS. Hide the ones you don&apos;t want online,
                and star one to feature it.{" "}
                <Link href="/products" className="font-semibold text-brand-text hover:underline">
                  Add a product
                </Link>
                .
              </p>
              <div className="space-y-2.5">
                {db.products.map((product) => {
                  const hidden = storefront.hiddenProductIds.includes(product.id);
                  const featured = storefront.featuredProductId === product.id;
                  return (
                    <div
                      key={product.id}
                      className={cn(
                        "flex items-center gap-3 rounded-card border border-border-subtle bg-surface p-3 shadow-card",
                        hidden && "opacity-55",
                      )}
                    >
                      <span
                        className="flex size-10 shrink-0 items-center justify-center rounded-xl text-lg"
                        style={{ backgroundColor: `${product.swatch}1a` }}
                      >
                        {product.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold">{product.name}</p>
                        <p className="tabular text-[12px] text-text-secondary">
                          {money(product.price)}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          updateStorefront({
                            featuredProductId: featured ? undefined : product.id,
                          })
                        }
                        disabled={hidden}
                        aria-label={featured ? "Remove from featured" : "Feature this product"}
                        className={cn(
                          "inline-flex size-9 items-center justify-center rounded-full transition-colors disabled:opacity-40",
                          featured
                            ? "bg-brand text-brand-ink"
                            : "text-text-muted hover:bg-surface-hover",
                        )}
                      >
                        <Star className={cn("size-4", featured && "fill-current")} />
                      </button>
                      <button
                        onClick={() => toggleStorefrontProduct(product.id)}
                        aria-label={hidden ? "Show on site" : "Hide from site"}
                        className="inline-flex size-9 items-center justify-center rounded-full text-text-muted hover:bg-surface-hover"
                      >
                        {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Live preview */}
        <aside className="mt-8 lg:sticky lg:top-8 lg:mt-0 lg:self-start">
          <SectionTitle
            action={
              <Link
                href="/store"
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand-text"
              >
                Full size
                <ExternalLink className="size-3" />
              </Link>
            }
          >
            Live preview
          </SectionTitle>
          <div className="mx-auto w-[280px] rounded-[36px] bg-forest-950 p-2.5 shadow-overlay ring-1 ring-white/10">
            <div className="h-[520px] overflow-y-auto overscroll-contain rounded-[28px] bg-white">
              <StorefrontView storefront={storefront} products={db.products} compact />
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] text-text-muted">
            Updates as you edit. Scroll inside the phone.
          </p>
        </aside>
      </div>

      <div className="mt-8 flex justify-center lg:hidden">
        <Link
          href="/store"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-panel px-5 text-[14px] font-semibold text-panel-text"
        >
          <Pencil className="size-4" />
          Open the full site
        </Link>
      </div>
    </>
  );
}

/** Tiny wireframes so the template choice reads before you commit to it. */
function TemplateThumb({ id }: { id: StorefrontTemplate }) {
  const bar = "rounded-[2px] bg-text/15";
  const block = "rounded-[3px] bg-brand";
  return (
    <span className="flex h-20 w-full flex-col gap-1 overflow-hidden rounded-lg bg-surface-sunken p-2">
      {id === "spotlight" && (
        <>
          <span className="h-5 rounded-[3px] bg-text/70" />
          <span className={cn(block, "h-6")} />
          <span className="flex gap-1">
            <span className={cn(bar, "h-4 flex-1")} />
            <span className={cn(bar, "h-4 flex-1")} />
            <span className={cn(bar, "h-4 flex-1")} />
          </span>
        </>
      )}
      {id === "catalogue" && (
        <>
          <span className="h-2.5 rounded-[3px] bg-text/70" />
          <span className="grid flex-1 grid-cols-3 gap-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className={cn(i === 0 ? block : bar, "h-full")} />
            ))}
          </span>
        </>
      )}
      {id === "story" && (
        <>
          <span className="mx-auto h-2 w-2/3 rounded-[3px] bg-text/70" />
          <span className="flex flex-1 gap-1">
            <span className={cn(block, "w-1/2")} />
            <span className="flex w-1/2 flex-col justify-center gap-1">
              <span className={cn(bar, "h-1.5")} />
              <span className={cn(bar, "h-1.5 w-2/3")} />
            </span>
          </span>
        </>
      )}
      {id === "linkinbio" && (
        <>
          <span className="mx-auto size-5 rounded-full bg-text/70" />
          <span className={cn(block, "h-2.5")} />
          <span className={cn(bar, "h-2.5")} />
          <span className={cn(bar, "h-2.5")} />
          <span className={cn(bar, "h-2.5")} />
        </>
      )}
    </span>
  );
}
