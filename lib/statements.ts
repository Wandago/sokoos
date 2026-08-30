import { classifyDirection } from "./direction";
import type { Database, Direction, StatementRow, StatementRowState } from "./types";

/**
 * Statement parsing and duplicate detection.
 *
 * This is the part that has to be exactly right, and it needs no model to be
 * right: every M-Pesa and bank transaction carries a unique code, so re-importing
 * an overlapping period is a set operation, not a guess. Upload yesterday and
 * then the whole month, and every row from yesterday is recognised by its code
 * and skipped.
 *
 * Rows without a code — some cash and some bank narrations — cannot be deduped
 * this way, so they are flagged for review rather than silently imported twice.
 */

/** M-Pesa confirmation codes: 10 characters, letters and digits, upper case. */
const MPESA_CODE = /\b([A-Z][A-Z0-9]{9})\b/;

/** Bank references vary, so accept a looser token when a header names one. */
const BANK_REF = /\b([A-Z0-9]{6,20})\b/;

const AMOUNT = /(-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)/g;
/** Same shape, without the sticky global flag, so `.test` stays stateless. */
const HAS_AMOUNT = /-?\d/;

export interface ParseResult {
  rows: StatementRow[];
  source: "mpesa" | "bank";
  periodStart?: string;
  periodEnd?: string;
  /** Lines the parser could not make sense of, kept so nothing is hidden. */
  skipped: string[];
}

function parseAmount(token: string) {
  return Number(token.replace(/,/g, ""));
}

/** Accepts 2026-08-29, 29/08/2026, 29-08-2026 and "29 Aug 2026". */
function parseDate(text: string): string | undefined {
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T12:00:00`).toISOString();

  const dmy = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T12:00:00`).toISOString();
  }

  const named = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\b/);
  if (named) {
    const parsed = new Date(`${named[2]} ${named[1]}, ${named[3]} 12:00:00`);
    if (!Number.isNaN(+parsed)) return parsed.toISOString();
  }
  return undefined;
}

function classify(description: string, amountToken: string): Direction {
  const signed = amountToken.trim().startsWith("-") ? -1 : undefined;
  return classifyDirection(description, signed).direction;
}

/* ------------------------------------------------------------------ *
 * Column-aware parsing.
 *
 * A real M-Pesa or bank export names its columns, and separate "Paid In" and
 * "Withdrawn" columns settle the direction outright — no wording needed. When
 * the header is there we read by column and only fall back to scanning the
 * line when it is not.
 * ------------------------------------------------------------------ */

type Column = "code" | "date" | "description" | "paidIn" | "withdrawn" | "amount" | "balance";

const COLUMN_PATTERNS: [Column, RegExp][] = [
  ["code", /receipt|transaction\s*(id|no|ref)|^ref|reference/i],
  ["date", /date|time|completion/i],
  ["description", /details|description|narration|particular|reason/i],
  ["paidIn", /paid\s*in|money\s*in|credit/i],
  ["withdrawn", /withdraw|paid\s*out|money\s*out|debit/i],
  ["balance", /balance/i],
  ["amount", /amount/i],
];

function splitRow(line: string) {
  return line.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

/** Reads a header row into column positions, or null if it is not one. */
function readHeader(line: string): Partial<Record<Column, number>> | null {
  const cells = splitRow(line);
  if (cells.length < 3) return null;

  const map: Partial<Record<Column, number>> = {};
  cells.forEach((cell, index) => {
    for (const [column, pattern] of COLUMN_PATTERNS) {
      if (map[column] === undefined && pattern.test(cell)) {
        map[column] = index;
        return;
      }
    }
  });

  // A header has to name a date and at least one money column to be useful.
  const hasMoney =
    map.paidIn !== undefined || map.withdrawn !== undefined || map.amount !== undefined;
  return map.date !== undefined && hasMoney ? map : null;
}

function rowFromColumns(
  cells: string[],
  columns: Partial<Record<Column, number>>,
): StatementRow | null {
  const at = (column: Column) => (columns[column] !== undefined ? cells[columns[column]!] : undefined);

  const date = parseDate(at("date") ?? "");
  if (!date) return null;

  const paidIn = parseAmount(at("paidIn") ?? "");
  const withdrawn = parseAmount(at("withdrawn") ?? "");
  const plain = parseAmount(at("amount") ?? "");

  let amount: number;
  let direction: Direction;

  if (Number.isFinite(paidIn) && Math.abs(paidIn) > 0) {
    // The column itself is the answer: this money came in.
    amount = Math.abs(paidIn);
    direction = "credit";
  } else if (Number.isFinite(withdrawn) && Math.abs(withdrawn) > 0) {
    amount = Math.abs(withdrawn);
    direction = "debit";
  } else if (Number.isFinite(plain) && plain !== 0) {
    amount = Math.abs(plain);
    direction = classifyDirection(at("description") ?? "", plain).direction;
  } else {
    return null;
  }

  const raw = at("code") ?? "";
  const code = raw.match(MPESA_CODE)?.[1] ?? (/^[A-Z0-9]{6,20}$/.test(raw) ? raw : "");
  const balance = parseAmount(at("balance") ?? "");

  return {
    code,
    date,
    description: (at("description") ?? "").slice(0, 120),
    amount,
    direction,
    balance: Number.isFinite(balance) ? balance : undefined,
    state: "new",
  };
}

/**
 * Splits a pasted statement into rows. Handles comma and tab separated
 * exports as well as the loose text people paste out of an SMS thread.
 */
export function parseStatement(text: string): ParseResult {
  const skipped: string[] = [];
  const rows: StatementRow[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let source: "mpesa" | "bank" = "mpesa";
  if (/account statement|bank|equity|kcb|co-?operative|absa/i.test(text)) source = "bank";

  // If the export names its columns, read by column — it is exact.
  let columns: Partial<Record<Column, number>> | null = null;
  for (const line of lines.slice(0, 5)) {
    columns = readHeader(line);
    if (columns) break;
  }

  for (const line of lines) {
    if (columns) {
      if (readHeader(line)) continue;
      const cells = splitRow(line);
      const row = rowFromColumns(cells, columns);
      if (row) {
        rows.push(row);
        continue;
      }
      // Fall through to the loose scan rather than losing the line.
    }

    // Skip anything that reads like a header row.
    if (/^(receipt|transaction|date|details|description|no\.?|ref)\b/i.test(line) && !HAS_AMOUNT.test(line)) {
      continue;
    }

    const codeMatch = line.match(MPESA_CODE) ?? (source === "bank" ? line.match(BANK_REF) : null);
    const amounts = line.match(AMOUNT);
    const date = parseDate(line);

    if (!amounts || !date) {
      skipped.push(line);
      continue;
    }

    // On a statement the last two numbers are usually amount then balance.
    const amountToken = amounts.length > 1 ? amounts[amounts.length - 2] : amounts[0];
    const balanceToken = amounts.length > 1 ? amounts[amounts.length - 1] : undefined;
    const amount = Math.abs(parseAmount(amountToken));
    if (!Number.isFinite(amount) || amount === 0) {
      skipped.push(line);
      continue;
    }

    // Strip everything that is already its own field — the code, the date, the
    // time and the money columns — so what is left is the narration a person
    // would actually read.
    const description = line
      .replace(codeMatch?.[1] ?? "", "")
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, "")
      .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/g, "")
      .replace(/\b\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}\b/g, "")
      .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\s*(?:[AaPp]\.?[Mm]\.?)?\b/g, "")
      .replace(/-?(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}\b/g, "")
      .replace(/[\t,;]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .replace(/^[\s,;-]+|[\s,;-]+$/g, "")
      .trim();

    rows.push({
      code: codeMatch?.[1] ?? "",
      date,
      description: description.slice(0, 120),
      amount,
      direction: classify(description, amountToken),
      balance: balanceToken ? parseAmount(balanceToken) : undefined,
      state: "new",
    });
  }

  const dates = rows.map((r) => +new Date(r.date)).sort((a, b) => a - b);

  return {
    rows,
    source,
    periodStart: dates.length ? new Date(dates[0]).toISOString() : undefined,
    periodEnd: dates.length ? new Date(dates[dates.length - 1]).toISOString() : undefined,
    skipped,
  };
}

/** Every reference already in the books, normalised for comparison. */
export function existingReferences(db: Database) {
  const refs = new Set<string>();
  db.ledger.forEach((entry) => entry.reference && refs.add(entry.reference.toUpperCase()));
  db.payments.forEach((payment) => payment.reference && refs.add(payment.reference.toUpperCase()));
  db.captures.forEach(
    (capture) =>
      capture.extracted.transactionId &&
      refs.add(capture.extracted.transactionId.toUpperCase()),
  );
  return refs;
}

export interface DedupeSummary {
  rows: StatementRow[];
  total: number;
  fresh: number;
  alreadyImported: number;
  duplicateInFile: number;
  needsReview: number;
}

/**
 * Marks every parsed row against what is already in the books and against the
 * rest of the file. Nothing is written here — the seller sees the verdict
 * before anything is committed.
 */
export function dedupe(rows: StatementRow[], db: Database): DedupeSummary {
  const known = existingReferences(db);
  const seenInFile = new Set<string>();

  // A same-day, same-amount row without a code is probably the one you already
  // have. Probably is not certain, so it goes to review rather than the bin.
  const fingerprints = new Set([
    ...db.ledger.map((entry) => `${entry.date.slice(0, 10)}|${Math.round(entry.amount)}`),
    ...db.payments.map((payment) => `${payment.receivedAt.slice(0, 10)}|${Math.round(payment.amount)}`),
  ]);

  const marked = rows.map<StatementRow>((row) => {
    const code = row.code.toUpperCase();

    if (!code) {
      const fingerprint = `${row.date.slice(0, 10)}|${Math.round(row.amount)}`;
      return fingerprints.has(fingerprint)
        ? {
            ...row,
            state: "needs_review" as StatementRowState,
            note: "No transaction code, and the books already hold the same amount on this date.",
          }
        : {
            ...row,
            state: "needs_review" as StatementRowState,
            note: "No transaction code on this row, so it cannot be checked for duplicates automatically.",
          };
    }

    if (known.has(code)) {
      return { ...row, state: "already_imported", note: `${code} is already in your books.` };
    }

    if (seenInFile.has(code)) {
      return { ...row, state: "duplicate_in_file", note: `${code} appears twice in this file.` };
    }

    seenInFile.add(code);
    return { ...row, state: "new" };
  });

  return {
    rows: marked,
    total: marked.length,
    fresh: marked.filter((r) => r.state === "new").length,
    alreadyImported: marked.filter((r) => r.state === "already_imported").length,
    duplicateInFile: marked.filter((r) => r.state === "duplicate_in_file").length,
    needsReview: marked.filter((r) => r.state === "needs_review").length,
  };
}

/** Guesses a ledger category from the narration, so imports land somewhere sane. */
export function categorise(description: string, direction: Direction) {
  const text = description.toLowerCase();
  if (direction === "credit") return "Sales";
  if (/airtime|bundle|safaricom|data/.test(text)) return "Airtime & data";
  if (/rent|landlord/.test(text)) return "Rent";
  if (/fuel|petrol|shell|total|rubis/.test(text)) return "Transport";
  if (/rider|boda|delivery|courier/.test(text)) return "Delivery";
  if (/pack|box|bag|tissue/.test(text)) return "Packaging";
  if (/flour|sugar|milk|market|wholesale|supplier|gikomba|stock/.test(text)) return "Stock";
  if (/ads|boost|promo|marketing/.test(text)) return "Marketing";
  if (/salary|wage|casual/.test(text)) return "Salaries";
  if (/charge|fee|excise|levy/.test(text)) return "Bank charges";
  return "Other";
}

/**
 * A realistic sample, so the screen can be tried without a real statement to
 * hand. Deliberately overlaps the seeded books to show dedupe working.
 */
export function sampleStatement(db: Database) {
  const header = "Receipt No.,Completion Time,Details,Paid In,Withdrawn,Balance";

  // Reuse codes the books already hold: these must come back as duplicates.
  const existing = db.payments
    .filter((payment) => /^[A-Z][A-Z0-9]{9}$/.test(payment.reference))
    .slice(0, 6)
    .map((payment) => {
      const at = new Date(payment.receivedAt);
      const stamp = `${at.toISOString().slice(0, 10)} ${at.toTimeString().slice(0, 8)}`;
      return `${payment.reference},${stamp},Received from ${payment.customerName.toUpperCase()},${payment.amount.toFixed(2)},,0.00`;
    });

  const fresh = [
    "TFA4K21LMN,2026-08-29 09:14:22,Received from JANE WANJIKU 0722418903,4200.00,,182430.55",
    "TFB7M09PQR,2026-08-29 10:02:11,Paid to GIKOMBA MILLERS,,8600.00,173830.55",
    "TFC2N88STU,2026-08-29 11:47:03,Received from BRIAN OTIENO 0710552187,6200.00,,180030.55",
    "TFD5P31VWX,2026-08-29 13:20:44,Airtime purchase for 0722000145,,1000.00,179030.55",
    "TFE9Q64YZA,2026-08-29 15:05:19,Paid to BIASHARA PACKAGING,,2600.00,176430.55",
    "TFF3R27BCD,2026-08-29 16:41:55,Received from ACHIENG ODHIAMBO 0733908214,4700.00,,181130.55",
    "TFG8S50EFG,2026-08-29 17:58:07,Boda rider payout MUSA ABDI,,1400.00,179730.55",
    // Deliberately repeated inside the file.
    "TFB7M09PQR,2026-08-29 10:02:11,Paid to GIKOMBA MILLERS,,8600.00,173830.55",
    // No code at all, so it cannot be deduped automatically.
    ",2026-08-29 18:30:00,Cash sale at the stall,3000.00,,182730.55",
  ];

  return [header, ...existing, ...fresh].join("\n");
}
