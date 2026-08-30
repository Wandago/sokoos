import type { Direction } from "./types";

/**
 * Credit or debit, decided from words.
 *
 * The seller's question is always the same one: did this money come in or go
 * out? That is answerable from the language on a receipt, in an M-Pesa
 * message, or in a spoken sentence, without a model — and answerable in a way
 * that can show its reasoning, which matters more than being clever. Every
 * verdict names the phrase it turned on so the seller can correct it.
 */

interface Rule {
  direction: Direction;
  /** Phrases that settle it, strongest first. */
  phrases: string[];
  weight: number;
}

const RULES: Rule[] = [
  // Unambiguous M-Pesa and bank narration.
  { direction: "credit", weight: 3, phrases: ["you have received", "received from", "payment from", "credited", "deposit of", "has deposited"] },
  { direction: "debit", weight: 3, phrases: ["paid to", "you have sent", "sent to", "withdraw", "buy goods", "pay bill", "paybill", "purchased", "debited"] },

  // Ordinary speech, the way a seller actually says it.
  { direction: "credit", weight: 2, phrases: ["received", "got paid", "customer paid", "sold", "sale", "deposit", "refund from", "reversal", "collected"] },
  { direction: "debit", weight: 2, phrases: ["paid", "bought", "spent", "restocked", "topped up", "fuelled", "fueled", "settled", "gave", "expense", "bill"] },

  // Weak hints, used only when nothing stronger fires.
  { direction: "credit", weight: 1, phrases: ["income", "in from", "money in"] },
  { direction: "debit", weight: 1, phrases: ["invoice", "receipt", "supplier", "rent", "salary", "airtime", "delivery fee", "money out"] },
];

export interface DirectionVerdict {
  direction: Direction;
  /** The phrase the decision turned on, or why there wasn't one. */
  reason: string;
  /** 0–1. Low means the seller should look before it is filed. */
  confidence: number;
}

/**
 * A leading minus, or an amount in a "withdrawn" column, beats any wording —
 * a statement's own sign is the strongest evidence there is.
 */
export function classifyDirection(text: string, signedAmount?: number): DirectionVerdict {
  if (signedAmount !== undefined && signedAmount < 0) {
    return { direction: "debit", reason: "The amount is negative.", confidence: 0.99 };
  }

  const haystack = text.toLowerCase();

  let best: { rule: Rule; phrase: string } | null = null;
  for (const rule of RULES) {
    for (const phrase of rule.phrases) {
      if (!haystack.includes(phrase)) continue;
      if (!best || rule.weight > best.rule.weight) best = { rule, phrase };
    }
  }

  if (!best) {
    // Money on a receipt or a statement is more often going out than coming in,
    // so that is the safer default — but say so rather than pretending to know.
    return {
      direction: "debit",
      reason: "Nothing in the wording said either way, so this is filed as money out.",
      confidence: 0.4,
    };
  }

  const confidence = best.rule.weight >= 3 ? 0.96 : best.rule.weight === 2 ? 0.82 : 0.6;
  return {
    direction: best.rule.direction,
    reason: `“${best.phrase}” means money ${best.rule.direction === "credit" ? "in" : "out"}.`,
    confidence,
  };
}
