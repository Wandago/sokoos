"use client";

import { AtSign, MapPin, MessageCircle, Music2, Truck } from "lucide-react";
import type { Product, Storefront } from "@/lib/types";
import { orderLink, palettes, visibleProducts } from "@/lib/storefront";
import { money } from "@/lib/format";

/**
 * The four storefront layouts.
 *
 * Every one takes the same props and reads the same palette, so a seller can
 * switch template without losing a word of what they wrote. Colours come from
 * the palette object rather than Tailwind tokens, because these pages wear the
 * seller's brand, not the app's.
 */
export interface TemplateProps {
  storefront: Storefront;
  products: Product[];
  /** Shrinks type and spacing for the editor's phone preview. */
  compact?: boolean;
}

function useTheme(storefront: Storefront) {
  return palettes[storefront.palette];
}

/* ---- Shared pieces ------------------------------------------------- */

function OrderButton({
  storefront,
  product,
  label = "Order on WhatsApp",
  compact,
  block,
  /** Set when the button sits on the band rather than the page. */
  onBand,
}: {
  storefront: Storefront;
  product?: Product;
  label?: string;
  compact?: boolean;
  block?: boolean;
  onBand?: boolean;
}) {
  const t = palettes[storefront.palette];
  const background = onBand ? t.bandAccent : t.accent;
  const ink = onBand ? t.bandAccentInk : t.accentInk;
  return (
    <a
      href={orderLink(storefront, product)}
      target="_blank"
      rel="noreferrer noopener"
      className={`inline-flex items-center justify-center gap-2 rounded-full font-bold transition-[filter] hover:brightness-95 ${
        compact ? "h-8 px-3 text-[11px]" : "h-12 px-6 text-[15px]"
      } ${block ? "w-full" : ""}`}
      style={{ background, color: ink }}
    >
      <MessageCircle className={compact ? "size-3.5" : "size-4"} strokeWidth={2.4} />
      {label}
    </a>
  );
}

function Socials({ storefront, compact }: { storefront: Storefront; compact?: boolean }) {
  const t = palettes[storefront.palette];
  const items = [
    storefront.instagram && {
      icon: AtSign,
      label: `@${storefront.instagram}`,
      href: `https://instagram.com/${storefront.instagram}`,
    },
    storefront.tiktok && {
      icon: Music2,
      label: `@${storefront.tiktok}`,
      href: `https://tiktok.com/@${storefront.tiktok}`,
    },
  ].filter(Boolean) as { icon: typeof AtSign; label: string; href: string }[];

  if (!items.length) return null;
  return (
    <div className={`flex flex-wrap items-center gap-3 ${compact ? "text-[10px]" : "text-[13px]"}`}>
      {items.map((item) => (
        <a
          key={item.href}
          href={item.href}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 font-medium hover:underline"
          style={{ color: t.muted }}
        >
          <item.icon className={compact ? "size-3" : "size-4"} />
          {item.label}
        </a>
      ))}
    </div>
  );
}

/** Product artwork stands in for photography until the seller uploads theirs. */
function ProductArt({
  product,
  className,
  compact,
}: {
  product: Product;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-center overflow-hidden ${className ?? ""}`}
      style={{ background: `${product.swatch}1f` }}
    >
      <span className={compact ? "text-2xl" : "text-6xl"}>{product.emoji}</span>
    </div>
  );
}

function Footer({ storefront, compact }: { storefront: Storefront; compact?: boolean }) {
  const t = palettes[storefront.palette];
  return (
    <footer
      className={compact ? "px-4 py-5" : "px-6 py-10 sm:px-10"}
      style={{ background: t.band, color: t.bandInk }}
    >
      <p className={compact ? "text-[12px] font-bold" : "text-[18px] font-extrabold tracking-tight"}>
        {storefront.headline}
      </p>
      <div
        className={`mt-2 flex flex-wrap gap-x-4 gap-y-1 ${compact ? "text-[9px]" : "text-[13px]"}`}
        style={{ opacity: 0.75 }}
      >
        <span className="inline-flex items-center gap-1.5">
          <MapPin className={compact ? "size-3" : "size-3.5"} />
          {storefront.location}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Truck className={compact ? "size-3" : "size-3.5"} />
          {storefront.deliveryNote}
        </span>
      </div>
      <p className={`mt-4 ${compact ? "text-[8px]" : "text-[11px]"}`} style={{ opacity: 0.5 }}>
        Powered by SokoOS
      </p>
    </footer>
  );
}

/* ---- 1. Spotlight --------------------------------------------------- */

export function SpotlightTemplate({ storefront, products, compact }: TemplateProps) {
  const t = useTheme(storefront);
  const shown = visibleProducts(products, storefront);
  const [hero, ...rest] = shown;

  return (
    <div style={{ background: t.bg, color: t.text }}>
      <section
        className={compact ? "px-4 pb-6 pt-6" : "px-6 pb-14 pt-12 sm:px-10 sm:pb-20 sm:pt-16"}
        style={{ background: t.band, color: t.bandInk }}
      >
        <p
          className={`font-bold uppercase tracking-[0.18em] ${compact ? "text-[8px]" : "text-[12px]"}`}
          style={{ opacity: 0.6 }}
        >
          {storefront.location}
        </p>
        <h1
          className={`mt-2 font-extrabold leading-[1.02] tracking-[-0.04em] ${
            compact ? "text-[22px]" : "text-[44px] sm:text-[64px]"
          }`}
        >
          {storefront.headline}
        </h1>
        <p
          className={`mt-3 max-w-lg leading-relaxed ${compact ? "text-[10px]" : "text-[17px]"}`}
          style={{ opacity: 0.8 }}
        >
          {storefront.tagline}
        </p>
        <div className={compact ? "mt-4" : "mt-7"}>
          <OrderButton storefront={storefront} compact={compact} onBand />
        </div>
      </section>

      {hero && (
        <section className={compact ? "px-4 py-5" : "px-6 py-12 sm:px-10"}>
          <div
            className={`grid overflow-hidden rounded-[20px] ${compact ? "" : "sm:grid-cols-2"}`}
            style={{ background: t.surface, border: `1px solid ${t.border}` }}
          >
            <ProductArt
              product={hero}
              compact={compact}
              className={compact ? "h-28" : "min-h-72"}
            />
            <div className={compact ? "p-3" : "p-8"}>
              <p
                className={`font-bold uppercase tracking-[0.16em] ${compact ? "text-[8px]" : "text-[11px]"}`}
                style={{ color: t.muted }}
              >
                Featured
              </p>
              <h2
                className={`mt-1.5 font-extrabold tracking-[-0.03em] ${
                  compact ? "text-[14px]" : "text-[30px]"
                }`}
              >
                {hero.name}
              </h2>
              {storefront.showPrices && (
                <p
                  className={`tabular mt-2 font-extrabold ${compact ? "text-[13px]" : "text-[24px]"}`}
                >
                  {money(hero.price)}
                </p>
              )}
              <p
                className={`mt-3 leading-relaxed ${compact ? "text-[9px]" : "text-[15px]"}`}
                style={{ color: t.muted }}
              >
                {hero.category} · {hero.stock > 0 ? "In stock" : "Made to order"}
              </p>
              <div className={compact ? "mt-3" : "mt-6"}>
                <OrderButton
                  storefront={storefront}
                  product={hero}
                  label="Order this"
                  compact={compact}
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section className={compact ? "px-4 pb-6" : "px-6 pb-16 sm:px-10"}>
          <h2
            className={`mb-4 font-extrabold tracking-[-0.03em] ${
              compact ? "text-[13px]" : "text-[26px]"
            }`}
          >
            Everything else
          </h2>
          <div className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"}`}>
            {rest.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                storefront={storefront}
                compact={compact}
              />
            ))}
          </div>
        </section>
      )}

      <Footer storefront={storefront} compact={compact} />
    </div>
  );
}

function ProductCard({
  product,
  storefront,
  compact,
}: {
  product: Product;
  storefront: Storefront;
  compact?: boolean;
}) {
  const t = palettes[storefront.palette];
  return (
    <a
      href={orderLink(storefront, product)}
      target="_blank"
      rel="noreferrer noopener"
      className="group block overflow-hidden rounded-[16px] transition-transform hover:-translate-y-0.5"
      style={{ background: t.surface, border: `1px solid ${t.border}` }}
    >
      <ProductArt product={product} compact={compact} className={compact ? "h-16" : "h-44"} />
      <div className={compact ? "p-2" : "p-3.5"}>
        <p className={`truncate font-semibold ${compact ? "text-[9px]" : "text-[14px]"}`}>
          {product.name}
        </p>
        {storefront.showPrices && (
          <p className={`tabular mt-0.5 font-bold ${compact ? "text-[9px]" : "text-[14px]"}`}>
            {money(product.price)}
          </p>
        )}
      </div>
    </a>
  );
}

/* ---- 2. Catalogue --------------------------------------------------- */

export function CatalogueTemplate({ storefront, products, compact }: TemplateProps) {
  const t = useTheme(storefront);
  const shown = visibleProducts(products, storefront);

  return (
    <div style={{ background: t.bg, color: t.text }}>
      <header
        className={`flex items-center justify-between gap-4 ${
          compact ? "px-4 py-3" : "px-6 py-5 sm:px-10"
        }`}
        style={{ borderBottom: `1px solid ${t.border}` }}
      >
        <div className="min-w-0">
          <p
            className={`truncate font-extrabold tracking-[-0.03em] ${
              compact ? "text-[13px]" : "text-[22px]"
            }`}
          >
            {storefront.headline}
          </p>
          <p className={`truncate ${compact ? "text-[8px]" : "text-[13px]"}`} style={{ color: t.muted }}>
            {storefront.tagline}
          </p>
        </div>
        <OrderButton storefront={storefront} label="Order" compact={compact} />
      </header>

      <section className={compact ? "px-4 py-4" : "px-6 py-8 sm:px-10"}>
        <p
          className={`mb-3 font-bold uppercase tracking-[0.16em] ${
            compact ? "text-[8px]" : "text-[12px]"
          }`}
          style={{ color: t.muted }}
        >
          {shown.length} products · {storefront.location}
        </p>
        <div
          className={`grid gap-2.5 ${compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"}`}
        >
          {shown.map((product) => (
            <a
              key={product.id}
              href={orderLink(storefront, product)}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-2.5 rounded-[14px] p-2 transition-transform hover:-translate-y-0.5"
              style={{ background: t.surface, border: `1px solid ${t.border}` }}
            >
              <ProductArt
                product={product}
                compact
                className={`shrink-0 rounded-[10px] ${compact ? "size-9" : "size-14"}`}
              />
              <span className="min-w-0 flex-1">
                <span className={`block truncate font-semibold ${compact ? "text-[9px]" : "text-[13px]"}`}>
                  {product.name}
                </span>
                {storefront.showPrices && (
                  <span
                    className={`tabular block font-bold ${compact ? "text-[9px]" : "text-[13px]"}`}
                  >
                    {money(product.price)}
                  </span>
                )}
                <span
                  className={`block truncate ${compact ? "text-[8px]" : "text-[11px]"}`}
                  style={{ color: t.muted }}
                >
                  {product.category}
                </span>
              </span>
            </a>
          ))}
        </div>
      </section>

      <Footer storefront={storefront} compact={compact} />
    </div>
  );
}

/* ---- 3. Story ------------------------------------------------------- */

export function StoryTemplate({ storefront, products, compact }: TemplateProps) {
  const t = useTheme(storefront);
  const shown = visibleProducts(products, storefront).slice(0, 6);

  return (
    <div style={{ background: t.bg, color: t.text }}>
      <section className={compact ? "px-4 pb-5 pt-7 text-center" : "px-6 pb-14 pt-20 text-center sm:px-10"}>
        <p
          className={`font-bold uppercase tracking-[0.2em] ${compact ? "text-[8px]" : "text-[12px]"}`}
          style={{ color: t.muted }}
        >
          {storefront.location}
        </p>
        <h1
          className={`mx-auto mt-3 max-w-3xl font-extrabold leading-[1.03] tracking-[-0.04em] ${
            compact ? "text-[20px]" : "text-[42px] sm:text-[58px]"
          }`}
        >
          {storefront.headline}
        </h1>
        <p
          className={`mx-auto mt-4 max-w-xl leading-relaxed ${compact ? "text-[10px]" : "text-[17px]"}`}
          style={{ color: t.muted }}
        >
          {storefront.about}
        </p>
        <div className={compact ? "mt-4 flex justify-center" : "mt-8 flex justify-center"}>
          <OrderButton storefront={storefront} compact={compact} />
        </div>
      </section>

      <section className={compact ? "space-y-4 px-4 pb-6" : "space-y-14 px-6 pb-20 sm:px-10"}>
        {shown.map((product, i) => (
          <div
            key={product.id}
            className={`grid items-center gap-4 ${compact ? "" : "gap-10 sm:grid-cols-2"}`}
          >
            <ProductArt
              product={product}
              compact={compact}
              className={`rounded-[20px] ${compact ? "h-24" : "h-80"} ${
                !compact && i % 2 === 1 ? "sm:order-2" : ""
              }`}
            />
            <div>
              <p
                className={`font-bold uppercase tracking-[0.16em] ${
                  compact ? "text-[8px]" : "text-[11px]"
                }`}
                style={{ color: t.muted }}
              >
                {product.category}
              </p>
              <h2
                className={`mt-1.5 font-extrabold tracking-[-0.03em] ${
                  compact ? "text-[13px]" : "text-[28px]"
                }`}
              >
                {product.name}
              </h2>
              {storefront.showPrices && (
                <p className={`tabular mt-2 font-bold ${compact ? "text-[11px]" : "text-[20px]"}`}>
                  {money(product.price)}
                </p>
              )}
              <div className={compact ? "mt-2.5" : "mt-5"}>
                <OrderButton
                  storefront={storefront}
                  product={product}
                  label="Enquire"
                  compact={compact}
                />
              </div>
            </div>
          </div>
        ))}
      </section>

      <Footer storefront={storefront} compact={compact} />
    </div>
  );
}

/* ---- 4. Link in bio -------------------------------------------------- */

export function LinkInBioTemplate({ storefront, products, compact }: TemplateProps) {
  const t = useTheme(storefront);
  const shown = visibleProducts(products, storefront);

  return (
    <div className="min-h-full" style={{ background: t.band, color: t.bandInk }}>
      <div className={`mx-auto ${compact ? "max-w-none px-4 py-6" : "max-w-md px-5 py-12"}`}>
        <div className="text-center">
          <span
            className={`mx-auto flex items-center justify-center rounded-full font-extrabold ${
              compact ? "size-12 text-[16px]" : "size-24 text-[32px]"
            }`}
            style={{ background: t.bandAccent, color: t.bandAccentInk }}
          >
            {storefront.headline.slice(0, 2).toUpperCase()}
          </span>
          <h1
            className={`mt-3 font-extrabold tracking-[-0.03em] ${
              compact ? "text-[15px]" : "text-[26px]"
            }`}
          >
            {storefront.headline}
          </h1>
          <p
            className={`mx-auto mt-2 max-w-xs leading-relaxed ${compact ? "text-[9px]" : "text-[14px]"}`}
            style={{ opacity: 0.75 }}
          >
            {storefront.tagline}
          </p>
          <div className={`mt-3 flex justify-center ${compact ? "" : "mt-4"}`}>
            <Socials storefront={storefront} compact={compact} />
          </div>
        </div>

        <div className={compact ? "mt-4" : "mt-8"}>
          <OrderButton storefront={storefront} compact={compact} block onBand />
        </div>

        <div className={`space-y-2 ${compact ? "mt-3" : "mt-4"}`}>
          {shown.map((product) => (
            <a
              key={product.id}
              href={orderLink(storefront, product)}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-3 rounded-2xl p-2.5 transition-transform hover:-translate-y-0.5"
              style={{ background: t.surface, color: t.text, border: `1px solid ${t.border}` }}
            >
              <ProductArt
                product={product}
                compact
                className={`shrink-0 rounded-xl ${compact ? "size-9" : "size-14"}`}
              />
              <span className="min-w-0 flex-1">
                <span className={`block truncate font-semibold ${compact ? "text-[10px]" : "text-[14px]"}`}>
                  {product.name}
                </span>
                {storefront.showPrices && (
                  <span
                    className={`tabular block font-bold ${compact ? "text-[9px]" : "text-[13px]"}`}
                    style={{ color: t.muted }}
                  >
                    {money(product.price)}
                  </span>
                )}
              </span>
              <MessageCircle
                className={compact ? "size-3.5" : "size-4"}
                style={{ color: t.muted }}
              />
            </a>
          ))}
        </div>

        <p
          className={`mt-6 text-center ${compact ? "text-[8px]" : "text-[11px]"}`}
          style={{ opacity: 0.5 }}
        >
          {storefront.deliveryNote}
        </p>
        <p
          className={`mt-2 text-center ${compact ? "text-[8px]" : "text-[11px]"}`}
          style={{ opacity: 0.45 }}
        >
          Powered by SokoOS
        </p>
      </div>
    </div>
  );
}

/* ---- Router ---------------------------------------------------------- */

export function StorefrontView(props: TemplateProps) {
  switch (props.storefront.template) {
    case "catalogue":
      return <CatalogueTemplate {...props} />;
    case "story":
      return <StoryTemplate {...props} />;
    case "linkinbio":
      return <LinkInBioTemplate {...props} />;
    default:
      return <SpotlightTemplate {...props} />;
  }
}
