import {
  SpotAllInOne,
  SpotCapture,
  SpotConversation,
  SpotGrowth,
  SpotLedger,
  SpotPayment,
  SpotRider,
} from "@/components/spot";

export type CardTheme = "forest" | "lime" | "cream";

export interface OnboardingCard {
  id: string;
  eyebrow: string;
  headline: string;
  body: string;
  theme: CardTheme;
  Spot: typeof SpotAllInOne;
}

/** Card surfaces. Lime always carries ink; forest always carries paper. */
export const themes: Record<
  CardTheme,
  { card: string; text: string; muted: string; chip: string; dot: string }
> = {
  forest: {
    card: "bg-forest-900 text-white",
    text: "text-white",
    muted: "text-forest-200",
    chip: "bg-brand text-brand-ink",
    dot: "bg-brand",
  },
  lime: {
    card: "bg-brand text-brand-ink",
    text: "text-brand-ink",
    muted: "text-brand-ink/70",
    chip: "bg-forest-900 text-white",
    dot: "bg-forest-900",
  },
  cream: {
    card: "bg-[#EFF3E2] text-forest-950",
    text: "text-forest-950",
    muted: "text-forest-700",
    chip: "bg-forest-900 text-white",
    dot: "bg-forest-900",
  },
};

/**
 * One promise per card, in the order a seller meets them: the pitch, the
 * conversation, the money, the delivery, the books.
 */
export const onboardingCards: OnboardingCard[] = [
  {
    id: "all",
    eyebrow: "Welcome to SokoOS",
    headline: "Every sale. One place.",
    body: "Instagram, TikTok, WhatsApp, calls, walk-ins — every order lands in one book you actually trust.",
    theme: "forest",
    Spot: SpotAllInOne,
  },
  {
    id: "chat",
    eyebrow: "Orders",
    headline: "From DM to delivery.",
    body: "Turn a conversation into an order in three taps. The customer, the items and the address come with it.",
    theme: "lime",
    Spot: SpotConversation,
  },
  {
    id: "pay",
    eyebrow: "Payments",
    headline: "Know who has paid.",
    body: "M-Pesa, cash and bank in one list, each matched to the order it belongs to. No more scrolling your SMS.",
    theme: "cream",
    Spot: SpotPayment,
  },
  {
    id: "rider",
    eyebrow: "Delivery",
    headline: "Rider’s on the way.",
    body: "Assign a trusted rider by area, and see what’s on the road right now without making a single call.",
    theme: "forest",
    Spot: SpotRider,
  },
  {
    id: "capture",
    eyebrow: "Smart Capture",
    headline: "Snap it. We organise it.",
    body: "Photograph a receipt or an M-Pesa message. We read it, match it, and file it in your ledger.",
    theme: "lime",
    Spot: SpotCapture,
  },
  {
    id: "books",
    eyebrow: "Your books",
    headline: "Your books are up to date.",
    body: "Money in, money out, and what each sale actually earned — without a spreadsheet in sight.",
    theme: "cream",
    Spot: SpotLedger,
  },
];

export { SpotGrowth };
