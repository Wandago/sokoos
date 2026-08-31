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

import { parseSpokenNumber, parseSpokenDuration, MONEY_WORDS } from "./swahili";

/**
 * Pulls the amount out, however it was said: digits, "2k" shorthand, English
 * words, Swahili, or the Sheng that belongs to neither.
 */
export function parseAmount(transcript: string): number | null {
  const text = transcript.toLowerCase();

  // "2k", "15k" — common shorthand in a Nairobi shop.
  const shorthand = text.match(/\b(\d+(?:\.\d+)?)\s*k\b/);
  if (shorthand) return Math.round(Number(shorthand[1]) * 1000);

  // A decimal figure is unambiguous and beats any word reading.
  const decimal = text.match(/\b(\d{1,3}(?:,\d{3})+|\d+)\.(\d{1,2})\b/);
  if (decimal) return Number(`${decimal[1].replace(/,/g, "")}.${decimal[2]}`);

  const spoken = parseSpokenNumber(text);
  return spoken ? spoken.value : null;
}

/** How long a job takes, said in either language. */
export { parseSpokenDuration };

/** "from Grace", "to Gikomba Millers" — whoever the money moved between. */
export function parseParty(transcript: string): string | null {
  // "kutoka kwa Grace" and "from Grace" mark the party the same way.
  const match = transcript.match(
    /\b(?:kutoka kwa|kutoka|kwenda kwa|kwa|from|to|for)\s+([A-Za-z][A-Za-z'’\-.]*(?:\s+[A-Za-z][A-Za-z'’\-.]*){0,3})/i,
  );
  if (!match) return null;

  // "for four thousand two hundred" is a price, not a person.
  const first = match[1].split(/\s+/)[0].toLowerCase();
  if (parseSpokenNumber(first) !== null) return null;

  // Trim the trailing words that belong to the next clause rather than the name.
  const stop = new Set([
    "for", "and", "na", "today", "yesterday", "leo", "jana",
    "on", "at", "the", "a", "an", "cash", "mpesa", "m-pesa", "bank", "card",
    ...MONEY_WORDS,
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
  if (/\bm-?pesa|till|paybill|send money|simu\b/.test(text)) return "mpesa";
  if (/\bcash|pesa taslimu|mkononi\b/.test(text)) return "cash";
  if (/\bbank|benki|transfer|equity|kcb\b/.test(text)) return "bank";
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

/**
 * The languages the microphone is offered in.
 *
 * Recognition is the browser's, so what it hears depends on the phone — but
 * the parsing underneath is ours and handles all three regardless, which means
 * a Swahili sentence typed on a phone with only English recognition still
 * works. The choice is remembered per device.
 */
export const speechLanguages = [
  { code: "en-KE", label: "English", hint: "I received three thousand five hundred from Grace" },
  { code: "sw-KE", label: "Kiswahili", hint: "Nimepokea elfu tatu na mia tano kutoka kwa Grace" },
] as const;

export type SpeechLanguage = (typeof speechLanguages)[number]["code"];

const LANGUAGE_KEY = "sokoos.speech.lang";

export function readSpeechLanguage(): SpeechLanguage {
  if (typeof window === "undefined") return "en-KE";
  try {
    const stored = window.localStorage.getItem(LANGUAGE_KEY);
    return stored === "sw-KE" ? "sw-KE" : "en-KE";
  } catch {
    return "en-KE";
  }
}

export function writeSpeechLanguage(code: SpeechLanguage) {
  try {
    window.localStorage.setItem(LANGUAGE_KEY, code);
  } catch {
    // A blocked storage is not a reason to refuse to listen.
  }
}

/* ------------------------------------------------------------------ *
 * Adding to the catalogue by talking.
 *
 * Typing a product into a form on a phone, standing in a shop, is the reason
 * catalogues stay empty. Saying "ongeza huduma, kushona nguo, elfu mbili, saa
 * moja" takes three seconds. The parse is the same machinery the transaction
 * capture uses, with one extra decision to make: is this a thing you sell or
 * work you do?
 * ------------------------------------------------------------------ */

/** Words that say plainly which of the two this is. */
const SERVICE_MARKERS = [
  "huduma", "kazi", "service", "job", "session", "appointment",
  "kushona", "kufua", "kunyoa", "kusuka", "kupiga picha", "repair", "fitting",
];
const PRODUCT_MARKERS = [
  "bidhaa", "kitu", "product", "item", "stock", "nguo", "kiatu", "chupa",
];

/** Verbs people open with, which are not part of the name. */
const OPENERS =
  /^\s*(?:ongeza|weka|add|create|new|nataka kuongeza|i want to add|register)\s+/i;

export interface SpokenItem {
  transcript: string;
  kind: "product" | "service";
  /** Why it was read as one or the other. */
  kindReason: string;
  name: string;
  price: number | null;
  /** Minutes, when a service and a duration was said. */
  durationMinutes: number | null;
  /** What it costs you to buy in, when that was said too. */
  cost: number | null;
  complete: boolean;
}

/**
 * Reads a spoken catalogue entry.
 *
 * A duration is the strongest signal there is: nothing you put on a shelf takes
 * forty-five minutes. So a stated time settles it as work even when the wording
 * says nothing either way.
 */
export function parseSpokenItem(transcript: string): SpokenItem {
  const raw = transcript.trim();
  const text = raw.toLowerCase();

  const duration = parseSpokenDuration(text);
  const serviceWord = SERVICE_MARKERS.find((word) => text.includes(word));
  const productWord = PRODUCT_MARKERS.find((word) => text.includes(word));

  let kind: SpokenItem["kind"];
  let kindReason: string;
  if (duration !== null) {
    kind = "service";
    kindReason = `It takes ${duration} minutes, so it is work rather than stock.`;
  } else if (serviceWord && !productWord) {
    kind = "service";
    kindReason = `“${serviceWord}” is work you do.`;
  } else if (productWord) {
    kind = "product";
    kindReason = `“${productWord}” is something you sell.`;
  } else {
    kind = "product";
    kindReason = "Nothing said either way, so it is filed as something you sell.";
  }

  /* Two figures may be said — what it sells for and what it cost to buy in.
   * "kwa elfu moja" / "costs me" marks the second one. */
  const costMatch = text.match(
    /(?:cost(?:s)?(?: me)?|bought(?: it)? for|nimenunua kwa|imeniuma|gharama)\s+([^.,;]{1,40})/,
  );
  const cost = costMatch ? parseAmount(costMatch[1]) : null;

  /* Take the cost phrase and the duration out before looking for the price.
   * "three thousand five hundred, four hours" would otherwise read as one
   * number and come back as 3,504. */
  let forPrice = costMatch ? text.replace(costMatch[0], " ") : text;
  forPrice = forPrice.replace(
    /[\p{L}\d][\p{L}\d\s-]{0,24}?\s*(?:dakika|minutes?|mins?|saa|hours?|hrs?)\b/giu,
    " ",
  );
  const price = parseAmount(forPrice);

  /* Whatever is left once the numbers, the opener and the marker words are
   * stripped out is the name. Better a short name the seller can fix than a
   * sentence pretending to be one. */
  let name = raw
    .replace(OPENERS, "")
    .replace(costMatch ? new RegExp(costMatch[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : / ^$/, " ")
    .replace(
      /\b(?:a|an|the|ni|kwa|ya|for|at|is|price|bei|inauzwa|nauza|takes|inachukua|huduma|bidhaa|service|product|item|kitu|new|nyingine)\b/gi,
      " ",
    )
    // Numbers and the words that make them.
    .replace(
      /\b(?:sifuri|moja|mbili|tatu|nne|tano|sita|saba|nane|tisa|kumi|ishirini|thelathini|arobaini|hamsini|sitini|sabini|themanini|tisini|mia|elfu|laki|milioni|ngiri|thao|kei|soo|mbao|finje|hamsa|chwani|punch|rwabe|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|na|and|shillings?|shilingi|bob|ksh|kes|pesa|dakika|minutes?|mins?|saa|hours?|hrs?|nusu)\b/gi,
      " ",
    )
    .replace(/[\d,]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.-]+|[\s,.-]+$/g, "")
    .trim();

  if (name) name = name.charAt(0).toUpperCase() + name.slice(1);

  return {
    transcript: raw,
    kind,
    kindReason,
    name,
    price,
    durationMinutes: duration,
    cost,
    complete: Boolean(name) && price !== null,
  };
}
