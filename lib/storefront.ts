import { call, syncConfigured } from "./sync/client";
import type { Product, Storefront, StorefrontPalette, StorefrontTemplate } from "./types";

/**
 * Storefront palettes.
 *
 * These are the seller's colours, not SokoOS's — a boutique and a hardware
 * stall should not have to look like the same shop. Every palette is a full
 * set, so a template never has to know which one it is wearing.
 */
export interface Palette {
  id: StorefrontPalette;
  name: string;
  /** Page background. */
  bg: string;
  /** Cards and panels. */
  surface: string;
  /** Body text. */
  text: string;
  /** Secondary text. */
  muted: string;
  /** Hairlines. */
  border: string;
  /** Buttons and highlights on the page background. */
  accent: string;
  /** What sits on top of the accent. */
  accentInk: string;
  /** The band used for heroes and footers. */
  band: string;
  /** What sits on the band. */
  bandInk: string;
  /**
   * A second accent for buttons that sit on the band.
   *
   * One accent cannot serve both: a dark accent disappears on a dark band, a
   * light one disappears on a light page. Palettes carry both so a call to
   * action is never invisible, whichever surface it lands on.
   */
  bandAccent: string;
  bandAccentInk: string;
}

export const palettes: Record<StorefrontPalette, Palette> = {
  lime: {
    id: "lime",
    name: "Lime",
    bg: "#F1F3EF",
    surface: "#FFFFFF",
    text: "#0C2917",
    muted: "#5B665A",
    border: "#E2E7DE",
    accent: "#C3F53C",
    accentInk: "#06160D",
    band: "#0C2917",
    bandInk: "#FFFFFF",
    bandAccent: "#C3F53C",
    bandAccentInk: "#06160D",
  },
  forest: {
    id: "forest",
    name: "Forest",
    bg: "#08150E",
    surface: "#1B3323",
    text: "#EAF2EB",
    muted: "#9FB2A4",
    border: "#26412E",
    accent: "#C3F53C",
    accentInk: "#06160D",
    band: "#11241A",
    bandInk: "#EAF2EB",
    bandAccent: "#C3F53C",
    bandAccentInk: "#06160D",
  },
  cream: {
    id: "cream",
    name: "Cream",
    bg: "#F6F2E8",
    surface: "#FFFDF8",
    text: "#2B2418",
    muted: "#786C58",
    border: "#E7DFCD",
    accent: "#2B2418",
    accentInk: "#FFFDF8",
    band: "#2B2418",
    bandInk: "#F6F2E8",
    bandAccent: "#F6F2E8",
    bandAccentInk: "#2B2418",
  },
  ink: {
    id: "ink",
    name: "Ink",
    bg: "#0E0E10",
    surface: "#23232A",
    text: "#F2F2F4",
    muted: "#9A9AA4",
    border: "#31313A",
    accent: "#F2F2F4",
    accentInk: "#0E0E10",
    band: "#17171B",
    bandInk: "#F2F2F4",
    bandAccent: "#F2F2F4",
    bandAccentInk: "#0E0E10",
  },
  clay: {
    id: "clay",
    name: "Clay",
    bg: "#FBF1EC",
    surface: "#FFFFFF",
    text: "#3B211A",
    muted: "#8A6154",
    border: "#F0DED5",
    accent: "#C2603C",
    accentInk: "#FFFFFF",
    band: "#3B211A",
    bandInk: "#FBF1EC",
    bandAccent: "#E08B62",
    bandAccentInk: "#2A150F",
  },
};

export const templates: {
  id: StorefrontTemplate;
  name: string;
  description: string;
  bestFor: string;
}[] = [
  {
    id: "spotlight",
    name: "Spotlight",
    description: "A big hero, one product blown up, the rest in a grid below.",
    bestFor: "Fashion and beauty",
  },
  {
    id: "catalogue",
    name: "Catalogue",
    description: "Straight to a dense, price-forward grid. No scrolling to shop.",
    bestFor: "Volume sellers",
  },
  {
    id: "story",
    name: "Story",
    description: "Editorial rows that alternate, with room to explain the craft.",
    bestFor: "Handmade and slow fashion",
  },
  {
    id: "linkinbio",
    name: "Link in bio",
    description: "One column: photo, links, products as rows. Built for a bio link.",
    bestFor: "Instagram and TikTok first",
  },
];

/** Products the site actually shows, in the order it shows them. */
export function visibleProducts(products: Product[], storefront: Storefront) {
  const shown = products.filter(
    (product) => product.active && !storefront.hiddenProductIds.includes(product.id),
  );
  const featured = shown.find((product) => product.id === storefront.featuredProductId);
  if (!featured) return shown;
  return [featured, ...shown.filter((product) => product.id !== featured.id)];
}

/**
 * Deep link into WhatsApp with the order already written out. This is the
 * whole checkout: the seller confirms in the chat they already live in.
 */
export function orderLink(storefront: Storefront, product?: Product) {
  const lines = product
    ? [`Hi ${storefront.headline}, I'd like to order:`, `• ${product.name} — KES ${product.price.toLocaleString("en-KE")}`]
    : [`Hi ${storefront.headline}, I'd like to place an order.`];
  return `https://wa.me/${storefront.whatsapp}?text=${encodeURIComponent(lines.join("\n"))}`;
}

export function storefrontUrl(storefront: Storefront) {
  return `sokoos.app/store/${storefront.slug}`;
}

/** True on a hosted build, where a shop's real address can be resolved by anyone, not just this device. */
export function hostedStorefronts() {
  return syncConfigured();
}

/** Fetches a business's published storefront by its public slug. No sign-in — the same request any customer's browser makes. */
export async function fetchHostedStorefront(
  slug: string,
): Promise<{ storefront: Storefront; products: Product[] }> {
  return call<{ storefront: Storefront; products: Product[] }>(
    `/store/${encodeURIComponent(slug)}`,
  );
}

export type ReportReason = "counterfeit" | "scam" | "offensive" | "impersonation" | "other";

/** A customer flagging a shop. Reaches SokoOS directly — there is nothing on this device to write it to. */
export async function fileStoreReport(
  slug: string,
  input: { reason: ReportReason; detail: string; contact?: string },
): Promise<void> {
  await call(`/store/${encodeURIComponent(slug)}/report`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
