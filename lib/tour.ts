import type { TourStep } from "@/components/product-tour";

export const TOURED_KEY = "sokoos.toured";

/**
 * Four stops, not a screen-by-screen inventory. The goal is to leave someone
 * knowing where to click when they need to, not to have shown them
 * everything — a tour that tries to cover the whole nav is just the nav
 * again, slower.
 */
export const appTourSteps: TourStep[] = [
  {
    selector: "tour-till",
    title: "Ring up a sale here.",
    body: "The till takes a payment and writes the sale down in the same tap — this is where most days start.",
  },
  {
    selector: "tour-orders",
    title: "Every order, one place.",
    body: "Instagram, WhatsApp, a call, a walk-in — wherever it came from, it lands here.",
  },
  {
    selector: "tour-add",
    title: "Add anything from here.",
    body: "A new order, a scanned receipt, a payment you took by hand — one button covers all of it.",
  },
  {
    selector: "tour-settings",
    title: "Your shop lives here.",
    body: "Your till number, your team and your mini site all live in Settings.",
  },
];
