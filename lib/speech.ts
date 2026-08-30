import { classifyDirection, type DirectionVerdict } from "./direction";
import { categorise } from "./statements";
import type { PaymentMethod } from "./types";

/**
 * Turning a spoken sentence into a transaction.
 *
 * "I received three thousand five hundred from Grace for two dresses" has to
 * become an amount, a direction, a party and a category. The words are the
 * seller's; the parsing is arithmetic and lookup, so it is testable and it
 * works with no network. Whatever it cannot find, it leaves blank rather than
 * filling in — a wrong number in the books is worse than a missing one.
 */

const SMALL: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const SCALES: Record<string, number> = { hundred: 100, thousand: 1000, million: 1_000_000 };

/** Reads "three thousand five hundred" the way a person says it. */
function wordsToNumber(words: string[]): number | null {
  let total = 0;
  let current = 0;
  let sawAny = false;

  for (const word of words) {
    if (word in SMALL) {
      current += SMALL[word];
      sawAny = true;
    } else if (word in SCALES) {
      const scale = SCALES[word];
      if (scale === 100) current = (current || 1) * 100;
      else {
        total += (current || 1) * scale;
        current = 0;
      }
      sawAny = true;
    } else if (word !== "and") {
      break;
    }
  }
  return sawAny ? total + current : null;
}

/** Pulls the amount out, whether it was said as digits, "2k", or words. */
export function parseAmount(transcript: string): number | null {
  const text = transcript.toLowerCase();

  // "2k", "15k" — common shorthand in a Nairobi shop.
  const shorthand = text.match(/\b(\d+(?:\.\d+)?)\s*k\b/);
  if (shorthand) return Math.round(Number(shorthand[1]) * 1000);

  const digits = text.match(/\b(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\b/);
  if (digits) {
    const whole = Number(digits[1].replace(/,/g, ""));
    const cents = digits[2] ? Number(`0.${digits[2]}`) : 0;
    if (whole > 0) return whole + cents;
  }

  // Spoken words: scan for the first run that reads as a number.
  const words = text.replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    if (!(words[i] in SMALL) && !(words[i] in SCALES)) continue;
    const value = wordsToNumber(words.slice(i, i + 8));
    if (value && value > 0) return value;
  }
  return null;
}

/** "from Grace", "to Gikomba Millers" — whoever the money moved between. */
export function parseParty(transcript: string): string | null {
  const match = transcript.match(
    /\b(?:from|to|for)\s+([A-Za-z][A-Za-z'’\-.]*(?:\s+[A-Za-z][A-Za-z'’\-.]*){0,3})/i,
  );
  if (!match) return null;

  // "for four thousand two hundred" is a price, not a person.
  const first = match[1].split(/\s+/)[0].toLowerCase();
  if (first in SMALL || first in SCALES) return null;

  // Trim the trailing words that belong to the next clause rather than the name.
  const stop = new Set([
    "for", "and", "shillings", "shilling", "bob", "ksh", "kes", "today", "yesterday",
    "on", "at", "the", "a", "an", "cash", "mpesa", "m-pesa", "bank", "card",
  ]);
  const words = match[1].split(/\s+/);
  const kept: string[] = [];
  for (const word of words) {
    if (stop.has(word.toLowerCase())) break;
    kept.push(word);
  }
  if (!kept.length) return null;
  return kept.join(" ").replace(/[.,]$/, "");
}

export function parseMethod(transcript: string): PaymentMethod | undefined {
  const text = transcript.toLowerCase();
  if (/\bm-?pesa|till|paybill|send money\b/.test(text)) return "mpesa";
  if (/\bcash\b/.test(text)) return "cash";
  if (/\bbank|transfer|equity|kcb\b/.test(text)) return "bank";
  if (/\bcard|visa|mastercard\b/.test(text)) return "card";
  return undefined;
}

export interface SpokenTransaction {
  transcript: string;
  amount: number | null;
  party: string | null;
  method?: PaymentMethod;
  category: string;
  verdict: DirectionVerdict;
  /** True when everything needed to file it was understood. */
  complete: boolean;
}

export function parseSpoken(transcript: string): SpokenTransaction {
  const amount = parseAmount(transcript);
  const party = parseParty(transcript);
  const verdict = classifyDirection(transcript);
  return {
    transcript: transcript.trim(),
    amount,
    party,
    method: parseMethod(transcript),
    category: categorise(transcript, verdict.direction),
    verdict,
    complete: amount !== null,
  };
}

/** Whether this browser can actually listen. Checked before anything is promised. */
export function speechSupported() {
  if (typeof window === "undefined") return false;
  return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
}
