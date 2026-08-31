/**
 * Numbers and money words as they are actually spoken in Nairobi.
 *
 * Nobody trades in one language here. A seller will say "nimepokea elfu tatu
 * na mia tano" in the same breath as "she paid three five", and the money
 * itself has its own vocabulary that belongs to neither language: ngiri is a
 * thousand, soo is a hundred, mbao is twenty, finje is fifty. An app that only
 * understands "three thousand five hundred" makes people talk like a form.
 *
 * So this parses Swahili and Sheng alongside English, and the same sentence
 * can mix all three, because that is how the sentence actually comes out.
 */

/**
 * Units and tens in both languages, in one table.
 *
 * They share a table rather than sitting in two, because a real sentence mixes
 * them — "nimepokea three thousand" is a thing people say — and two parsers
 * racing each other would only have to be reconciled afterwards.
 */
const SMALL: Record<string, number> = {
  // Swahili
  sifuri: 0,
  moja: 1, mbili: 2, tatu: 3, nne: 4, tano: 5,
  sita: 6, saba: 7, nane: 8, tisa: 9, kumi: 10,
  ishirini: 20, thelathini: 30, arobaini: 40, hamsini: 50,
  sitini: 60, sabini: 70, themanini: 80, tisini: 90,
  // English
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/**
 * Scales, with the order they are spoken in.
 *
 * Swahili puts the scale first — "elfu tatu", thousand three — where English
 * puts it last: "three thousand". Both have to work, so each scale records
 * which way round it is read.
 */
const SCALES: Record<string, { value: number; scaleFirst: boolean }> = {
  // Swahili. Laki is a hundred thousand and is used constantly.
  mia: { value: 100, scaleFirst: true },
  elfu: { value: 1000, scaleFirst: true },
  laki: { value: 100_000, scaleFirst: true },
  milioni: { value: 1_000_000, scaleFirst: true },
  // English
  hundred: { value: 100, scaleFirst: false },
  thousand: { value: 1000, scaleFirst: false },
  million: { value: 1_000_000, scaleFirst: false },
};

/**
 * Sheng money words. These are whole amounts, not multipliers — "ngiri tatu"
 * is three thousand, but a bare "ngiri" is one thousand.
 */
const SHENG: Record<string, number> = {
  ngiri: 1000,
  thao: 1000,
  kei: 1000,
  soo: 100,
  mbao: 20,
  finje: 50,
  hamsa: 50,
  chwani: 200,
  punch: 500,
  rwabe: 200,
};

/** Words that join parts of a number and should not break the run. */
const JOINERS = new Set(["na", "and", "-"]);

/** Currency words to ignore when scanning for the amount. */
export const MONEY_WORDS = new Set([
  "shillings", "shilling", "ksh", "kes", "bob", "shilingi", "pesa", "kshs",
]);

export interface ParsedNumber {
  value: number;
  /** Which words produced it, so the caller can strip them from a name. */
  matched: string[];
}

function normalise(text: string) {
  return (
    text
      .toLowerCase()
      // Thousands separators come out first: 4,200 is one number.
      .replace(/(\d),(?=\d{3}\b)/g, "$1")
      // A decimal point between digits is part of the number; everything else
      // is punctuation, and leaving it attached means "mbili," never matches.
      .replace(/(\d)\.(\d)/g, "$1<dot>$2")
      .replace(/[^\p{L}\p{N}\s-]/gu, " ")
      .replace(/<dot>/g, ".")
      .replace(/\s+/g, " ")
      .trim()
  );
}

/**
 * Reads a run of words as one number. Swahili builds amounts as
 * "elfu tatu na mia tano" — scale first, then how many — which is the reverse
 * of English, so both orders have to work.
 */
function readRun(words: string[]): ParsedNumber | null {
  let total = 0;
  let pending = 0;
  let sawAny = false;
  let lastScale: number | null = null;
  /** The last unit or ten seen, to tell a compound from a new term. */
  let lastPart: number | null = null;
  /** Whether a joining word sat immediately before the current token. */
  let joinedBefore = false;
  const matched: string[] = [];

  for (const word of words) {
    if (JOINERS.has(word) || MONEY_WORDS.has(word)) {
      // Only keep joining if a number is already under way.
      if (sawAny) {
        matched.push(word);
        joinedBefore = true;
        continue;
      }
      break;
    }

    // Sheng words carry their own value outright.
    if (word in SHENG) {
      // "ngiri tatu" — the count comes after, so hold it open.
      if (lastScale !== null) {
        total += (pending || 1) * lastScale;
        pending = 0;
      } else {
        total += pending;
        pending = 0;
      }
      lastScale = SHENG[word];
      lastPart = null;
      sawAny = true;
      matched.push(word);
      joinedBefore = false;
      continue;
    }

    if (word in SCALES) {
      const { value: scale, scaleFirst } = SCALES[word];

      if (scaleFirst) {
        if (lastScale !== null) {
          // "elfu tatu na mia tano" — bank what the last scale was holding.
          total += (pending || 1) * lastScale;
        } else if (joinedBefore) {
          total += pending;
        }
        /* An unjoined count sitting in front of a scale belongs to something
         * else: in "nguo mbili, mia tisa" the two is a number of garments, not
         * part of nine hundred. Without a "na" holding them together, drop it. */
        lastScale = scale;
        pending = 0;
        lastPart = null;
      } else {
        // "three thousand five hundred" — the count came first.
        if (scale === 100) pending = (pending || 1) * 100;
        else {
          total += (pending || 1) * scale;
          pending = 0;
        }
      }
      sawAny = true;
      matched.push(word);
      joinedBefore = false;
      continue;
    }

    if (word in SMALL) {
      const value = SMALL[word];
      /*
       * Swahili compounds a count out of parts that get smaller: "ishirini na
       * tano" is twenty-five. But "mia nne na hamsini" is four hundred and
       * fifty, not four-hundred-and-fiftys — the fifty is a new term, and you
       * can tell because it is bigger than the four before it. So a part only
       * joins the multiplier while it is smaller than the part before it.
       */
      if (lastScale !== null && lastPart !== null && value >= lastPart) {
        total += pending * lastScale;
        lastScale = null;
        pending = value;
      } else {
        pending += value;
      }
      lastPart = value;
      sawAny = true;
      matched.push(word);
      joinedBefore = false;
      continue;
    }

    // A bare figure, whether it opens the run ("45 minutes") or sits inside
    // one ("elfu 3").
    if (/^\d+$/.test(word.replace(/,/g, ""))) {
      pending += Number(word.replace(/,/g, ""));
      lastPart = null;
      sawAny = true;
      matched.push(word);
      joinedBefore = false;
      continue;
    }

    break;
  }

  if (!sawAny) return null;
  if (lastScale !== null) total += (pending || 1) * lastScale;
  else total += pending;

  // Trim trailing joiners that turned out to lead nowhere.
  while (matched.length && JOINERS.has(matched[matched.length - 1])) matched.pop();

  return total > 0 ? { value: total, matched } : null;
}

/**
 * Finds every spoken number in a sentence, longest run first, so
 * "elfu tatu na mia tano" reads as 3,500 rather than 3,000 and 500.
 */
export function parseSpokenNumber(text: string): ParsedNumber | null {
  const words = normalise(text).split(" ").filter(Boolean);

  let best: ParsedNumber | null = null;
  for (let i = 0; i < words.length; i++) {
    const run = readRun(words.slice(i, i + 10));
    if (!run) continue;
    // Prefer the run that consumed the most words — that is the whole amount.
    if (!best || run.matched.length > best.matched.length) best = run;
  }
  return best;
}

const MINUTE_UNITS = new Set(["dakika", "minute", "minutes", "min", "mins"]);
const HOUR_UNITS = new Set(["saa", "hour", "hours", "hr", "hrs"]);

/** Whether a token could be part of a number. */
function isNumberWord(word: string) {
  return (
    word in SMALL ||
    word in SCALES ||
    word in SHENG ||
    JOINERS.has(word) ||
    /^\d+(?:\.\d+)?$/.test(word)
  );
}

/**
 * A duration said in either language: "dakika arobaini na tano", "saa mbili",
 * "45 minutes", "four hours", "nusu saa".
 *
 * The number can sit on either side of the unit, so the unit is found first and
 * only the words immediately touching it are read. Scanning the whole sentence
 * instead would happily read the price as the duration.
 */
export function parseSpokenDuration(text: string): number | null {
  const clean = normalise(text);
  if (/\bnusu saa\b|\bhalf an hour\b/.test(clean)) return 30;

  const words = clean.split(" ").filter(Boolean);

  for (let i = 0; i < words.length; i++) {
    const isMinutes = MINUTE_UNITS.has(words[i]);
    const isHours = HOUR_UNITS.has(words[i]);
    if (!isMinutes && !isHours) continue;

    // Swahili puts the unit first — "dakika arobaini" — English puts it last.
    let after = i + 1;
    while (after < words.length && isNumberWord(words[after])) after++;
    const forward = after > i + 1 ? parseSpokenNumber(words.slice(i + 1, after).join(" ")) : null;

    /* Walk back only as far as the number touching the unit. An English scale
     * word ends the previous number — in "five hundred four hours" the four is
     * the duration and the five hundred is the price — so the walk stops there. */
    let before = i;
    while (
      before > 0 &&
      i - before < 4 &&
      isNumberWord(words[before - 1]) &&
      !(words[before - 1] in SCALES && !SCALES[words[before - 1]].scaleFirst)
    ) {
      before--;
    }
    const backward = before < i ? parseSpokenNumber(words.slice(before, i).join(" ")) : null;

    const value = forward?.value ?? backward?.value;
    if (value === undefined) continue;
    return isHours ? Math.round(value * 60) : value;
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * Words that decide what a sentence is about.
 * ------------------------------------------------------------------ */

/** Money coming in. */
export const CREDIT_WORDS_SW = [
  "nimepokea", "nimeuza", "amelipa", "nimelipwa", "mauzo", "nimepata", "imeingia", "malipo",
];

/** Money going out. */
export const DEBIT_WORDS_SW = [
  "nimelipa", "nimenunua", "nimetumia", "matumizi", "gharama", "imetoka", "nimempa",
];

/** A thing you sell. */
export const PRODUCT_WORDS_SW = ["bidhaa", "bidhaha", "kitu", "nguo", "chakula", "product", "item"];

/** Work you do. */
export const SERVICE_WORDS_SW = [
  "huduma", "kazi", "service", "job", "kushona", "kufua", "kunyoa", "kusuka", "kupiga picha",
];

/**
 * "from Grace" is "kutoka kwa Grace"; "to the supplier" is "kwa supplier".
 * The preposition is what marks the party in both languages.
 */
export const PARTY_MARKERS = /\b(?:from|to|for|kutoka kwa|kutoka|kwa|kwenda)\s+/i;

export function containsAny(text: string, words: string[]) {
  const clean = normalise(text);
  return words.find((word) => clean.includes(word));
}
