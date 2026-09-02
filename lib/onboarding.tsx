import {
  SpotAllInOne,
  SpotCapture,
  SpotConversation,
  SpotGrowth,
  SpotLedger,
  SpotPayment,
  SpotReceipt,
  SpotRider,
  SpotTill,
  SpotVoice,
} from "@/components/spot";

export type CardTheme = "forest" | "lime" | "cream";

export interface OnboardingCard {
  id: string;
  /** Two or three words, shown as pills. They say who this is for and what it costs in effort. */
  tags: string[];
  headline: string;
  body: string;
  theme: CardTheme;
  Spot: typeof SpotAllInOne;
}

/** Card surfaces. Lime always carries ink; forest always carries paper. */
export const themes: Record<
  CardTheme,
  { card: string; text: string; muted: string; chip: string; dot: string; panel: string }
> = {
  forest: {
    card: "bg-forest-900 text-white",
    text: "text-white",
    muted: "text-forest-200",
    chip: "bg-brand text-brand-ink",
    dot: "bg-forest-900",
    panel: "bg-forest-950/50",
  },
  lime: {
    card: "bg-brand text-brand-ink",
    text: "text-brand-ink",
    muted: "text-brand-ink/70",
    chip: "bg-forest-900 text-white",
    dot: "bg-brand",
    panel: "bg-white/35",
  },
  cream: {
    card: "bg-[#EFF3E2] text-forest-950",
    text: "text-forest-950",
    muted: "text-forest-700",
    chip: "bg-forest-900 text-white",
    dot: "bg-forest-700",
    panel: "bg-white/70",
  },
};

/**
 * One promise per card, in the order a seller meets them: the pitch, the
 * conversation, the money, the proof, the delivery, the books.
 *
 * Every card names something the app actually does today. A tour that promises
 * a feature the seller then cannot find is worse than no tour, because it
 * spends the one moment they were willing to read anything at all.
 */
export const onboardingCards: OnboardingCard[] = [
  {
    id: "all",
    tags: ["Start here"],
    headline: "Every sale. One place.",
    body: "Instagram, TikTok, WhatsApp, calls, walk-ins — every order lands in one book you actually trust.",
    theme: "forest",
    Spot: SpotAllInOne,
  },
  {
    id: "chat",
    tags: ["Orders", "From any DM"],
    headline: "From DM to delivery.",
    body: "Turn a conversation into an order in three taps. The customer, the items and the address come with it.",
    theme: "lime",
    Spot: SpotConversation,
  },
  {
    id: "voice",
    tags: ["Kiswahili", "English"],
    headline: "Just say it.",
    body: "“Nimepokea elfu tatu kutoka Grace.” Speak the sale and it files itself — in whichever language came out.",
    theme: "cream",
    Spot: SpotVoice,
  },
  {
    id: "pay",
    tags: ["Payments", "Your own till"],
    headline: "Know who has paid.",
    body: "Your till stays yours. The money lands in your account as it always has — SokoOS is only told, so it files itself.",
    theme: "forest",
    Spot: SpotTill,
  },
  {
    id: "receipt",
    tags: ["Receipts", "They can check it"],
    headline: "Proof, not paper.",
    body: "Every payment gets a receipt carrying its M-Pesa code, so the customer can check it against their own message.",
    theme: "lime",
    Spot: SpotReceipt,
  },
  {
    id: "rider",
    tags: ["Delivery", "Boda"],
    headline: "Rider’s on the way.",
    body: "Assign a rider by area and see what is on the road — including the fare the customer pays them at the door.",
    theme: "cream",
    Spot: SpotRider,
  },
  {
    id: "books",
    tags: ["Your books"],
    headline: "Up to date, already.",
    body: "Money in, money out, and what each sale actually earned — without a spreadsheet in sight.",
    theme: "forest",
    Spot: SpotLedger,
  },
];

export { SpotGrowth, SpotCapture, SpotPayment };
