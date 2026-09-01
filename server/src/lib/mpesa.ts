import { query, withTenant } from "../db/pool.js";
import { callbackSecret, decrypt, encrypt, maskSecret } from "./crypto.js";
import { normalisePhone } from "./phone.js";
import { push } from "./sync.js";

/**
 * M-Pesa, from the seller's own till.
 *
 * The customer pays the seller's shortcode. Safaricom tells us. We write it
 * into the seller's books and try to work out which order it was for. Money
 * never passes through SokoOS at any point, which is what keeps this a
 * bookkeeping tool rather than a licensed payment business.
 *
 * The practical consequence is that reconciliation *is* the product. The
 * seller's money is already in their account before this code runs — what they
 * cannot do without help is tell which of forty M-Pesa messages belongs to
 * which order, and that is the whole job here.
 */

const HOSTS = {
  sandbox: "https://sandbox.safaricom.co.ke",
  production: "https://api.safaricom.co.ke",
} as const;

export type Environment = keyof typeof HOSTS;

export interface MpesaAccount {
  tenantId: string;
  kind: "paybill" | "till";
  shortcode: string;
  environment: Environment;
  callbackSecret: string;
  registeredAt: string | null;
  lastEventAt: string | null;
}

export class NoMpesaAccount extends Error {
  constructor() {
    super("This business has not connected a till yet.");
    this.name = "NoMpesaAccount";
  }
}

export class DarajaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DarajaError";
  }
}

/* ------------------------------------------------------------------ *
 * The seller's own credentials
 * ------------------------------------------------------------------ */

export async function connectTill(
  tenantId: string,
  input: {
    kind: "paybill" | "till";
    shortcode: string;
    consumerKey: string;
    consumerSecret: string;
    passkey?: string;
    environment?: Environment;
  },
) {
  const secret = callbackSecret();

  const { rows } = await query<{ callback_secret: string }>(
    `insert into mpesa_accounts
       (tenant_id, kind, shortcode, consumer_key_enc, consumer_secret_enc, passkey_enc,
        environment, callback_secret)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (tenant_id) do update
        set kind = excluded.kind,
            shortcode = excluded.shortcode,
            consumer_key_enc = excluded.consumer_key_enc,
            consumer_secret_enc = excluded.consumer_secret_enc,
            passkey_enc = excluded.passkey_enc,
            environment = excluded.environment,
            -- Reconnecting keeps the existing callback URL, so a seller who
            -- re-enters their credentials does not have to re-register with
            -- Safaricom and lose payments in the gap.
            updated_at = now()
     returning callback_secret`,
    [
      tenantId,
      input.kind,
      input.shortcode.trim(),
      encrypt(input.consumerKey.trim()),
      encrypt(input.consumerSecret.trim()),
      input.passkey ? encrypt(input.passkey.trim()) : null,
      input.environment ?? "sandbox",
      secret,
    ],
  );

  return { callbackSecret: rows[0]!.callback_secret };
}

/** What a seller is shown about their own connection. Never the credentials. */
export async function tillStatus(tenantId: string, baseUrl: string) {
  const { rows } = await query<{
    kind: "paybill" | "till";
    shortcode: string;
    environment: Environment;
    callback_secret: string;
    registered_at: string | null;
    last_event_at: string | null;
    consumer_key_enc: string;
  }>(`select * from mpesa_accounts where tenant_id = $1`, [tenantId]);

  const account = rows[0];
  if (!account) return null;

  return {
    kind: account.kind,
    shortcode: account.shortcode,
    environment: account.environment,
    registeredAt: account.registered_at,
    lastEventAt: account.last_event_at,
    // Enough to confirm the right key was entered, not enough to use it.
    consumerKey: maskSecret(decrypt(account.consumer_key_enc)),
    confirmationUrl: `${baseUrl}/mpesa/c2b/${account.callback_secret}/confirmation`,
    validationUrl: `${baseUrl}/mpesa/c2b/${account.callback_secret}/validation`,
  };
}

async function credentialsFor(tenantId: string) {
  const { rows } = await query<{
    shortcode: string;
    environment: Environment;
    consumer_key_enc: string;
    consumer_secret_enc: string;
    passkey_enc: string | null;
  }>(
    `select shortcode, environment, consumer_key_enc, consumer_secret_enc, passkey_enc
       from mpesa_accounts where tenant_id = $1`,
    [tenantId],
  );
  const account = rows[0];
  if (!account) throw new NoMpesaAccount();
  return {
    shortcode: account.shortcode,
    environment: account.environment,
    consumerKey: decrypt(account.consumer_key_enc),
    consumerSecret: decrypt(account.consumer_secret_enc),
    passkey: account.passkey_enc ? decrypt(account.passkey_enc) : null,
  };
}

/* ------------------------------------------------------------------ *
 * Talking to Daraja
 * ------------------------------------------------------------------ */

/** Access tokens last an hour; caching them avoids a round trip per call. */
const tokens = new Map<string, { token: string; expires: number }>();

async function accessToken(tenantId: string) {
  const cached = tokens.get(tenantId);
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;

  const creds = await credentialsFor(tenantId);
  const basic = Buffer.from(`${creds.consumerKey}:${creds.consumerSecret}`).toString("base64");

  const response = await fetch(
    `${HOSTS[creds.environment]}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { authorization: `Basic ${basic}` } },
  );
  if (!response.ok) {
    throw new DarajaError(
      `Safaricom rejected the credentials (${response.status}). Check the consumer key and secret.`,
    );
  }
  const body = (await response.json()) as { access_token?: string; expires_in?: string };
  if (!body.access_token) throw new DarajaError("Safaricom did not return a token.");

  tokens.set(tenantId, {
    token: body.access_token,
    expires: Date.now() + Number(body.expires_in ?? 3599) * 1000,
  });
  return body.access_token;
}

/**
 * Tells Safaricom where to send this seller's payments.
 *
 * Done once per shortcode. `Completed` as the default means a payment is never
 * silently rejected because our service was down — the seller's money still
 * arrives, and we catch up from the statement importer if a callback is lost.
 */
export async function registerCallbacks(tenantId: string, baseUrl: string) {
  const creds = await credentialsFor(tenantId);
  const { rows } = await query<{ callback_secret: string }>(
    `select callback_secret from mpesa_accounts where tenant_id = $1`,
    [tenantId],
  );
  const secret = rows[0]!.callback_secret;
  const token = await accessToken(tenantId);

  const response = await fetch(`${HOSTS[creds.environment]}/mpesa/c2b/v1/registerurl`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      ShortCode: creds.shortcode,
      ResponseType: "Completed",
      ConfirmationURL: `${baseUrl}/mpesa/c2b/${secret}/confirmation`,
      ValidationURL: `${baseUrl}/mpesa/c2b/${secret}/validation`,
    }),
  });

  const body = (await response.json()) as { ResponseDescription?: string; errorMessage?: string };
  if (!response.ok || body.errorMessage) {
    throw new DarajaError(body.errorMessage ?? `Registration failed (${response.status}).`);
  }

  await query(`update mpesa_accounts set registered_at = now() where tenant_id = $1`, [tenantId]);
  return { registered: true, message: body.ResponseDescription ?? "Registered." };
}

/**
 * Asks a customer's phone for payment. Still not a payment through SokoOS —
 * the prompt is to pay the seller's own shortcode, and the money goes there.
 */
export async function requestPayment(
  tenantId: string,
  input: { phone: string; amount: number; reference: string; description?: string },
) {
  const creds = await credentialsFor(tenantId);
  if (!creds.passkey) {
    throw new DarajaError("A passkey is needed to request payment. Add it in Settings.");
  }

  const token = await accessToken(tenantId);
  const stamp = new Date()
    .toISOString()
    .replace(/[-:T]/g, "")
    .slice(0, 14);
  const password = Buffer.from(`${creds.shortcode}${creds.passkey}${stamp}`).toString("base64");
  const msisdn = normalisePhone(input.phone).replace("+", "");

  const response = await fetch(`${HOSTS[creds.environment]}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: creds.shortcode,
      Password: password,
      Timestamp: stamp,
      TransactionType: creds.shortcode.length === 6 ? "CustomerPayBillOnline" : "CustomerBuyGoodsOnline",
      Amount: Math.round(input.amount),
      PartyA: msisdn,
      PartyB: creds.shortcode,
      PhoneNumber: msisdn,
      // The order code, so the confirmation that follows can be matched to it.
      AccountReference: input.reference.slice(0, 12),
      TransactionDesc: (input.description ?? input.reference).slice(0, 13),
      CallBackURL: "",
    }),
  });

  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new DarajaError(String(body.errorMessage ?? "The request was refused."));
  return body;
}

/* ------------------------------------------------------------------ *
 * Receiving a payment
 * ------------------------------------------------------------------ */

/** The shape Safaricom posts on a C2B confirmation. */
export interface C2BPayload {
  TransactionType?: string;
  TransID?: string;
  TransTime?: string;
  TransAmount?: string | number;
  BusinessShortCode?: string;
  BillRefNumber?: string;
  MSISDN?: string;
  FirstName?: string;
  MiddleName?: string;
  LastName?: string;
  [key: string]: unknown;
}

/** Daraja sends `20260831142530`, which is Nairobi time, not UTC. */
function parseTransTime(value: string | undefined): string {
  if (!value || !/^\d{14}$/.test(value)) return new Date().toISOString();
  const [y, m, d, h, min, s] = [
    value.slice(0, 4),
    value.slice(4, 6),
    value.slice(6, 8),
    value.slice(8, 10),
    value.slice(10, 12),
    value.slice(12, 14),
  ];
  // +03:00 is Kenya, and it does not observe daylight saving.
  return new Date(`${y}-${m}-${d}T${h}:${min}:${s}+03:00`).toISOString();
}

function payerName(payload: C2BPayload) {
  return [payload.FirstName, payload.MiddleName, payload.LastName]
    .filter(Boolean)
    .join(" ")
    .trim();
}

export interface Confirmation {
  status: "posted" | "duplicate" | "rejected";
  reason?: string;
  transId?: string;
  paymentId?: string;
  /** Set only when the payment was confident enough to settle the order. */
  matchedOrder?: string;
  /** A lead the seller still has to confirm. Never settles anything. */
  suggestedOrder?: string;
  confidence?: number;
}

/**
 * The callback itself.
 *
 * Two things have to be true before anything is written. The secret in the URL
 * has to name a real account — Daraja does not sign its requests, so the URL is
 * the credential — and the shortcode in the payload has to be that account's
 * own. Without the second check a leaked URL could be used to invent income
 * for a business, which is a very cheap way to corrupt someone's books.
 */
export async function handleConfirmation(
  secret: string,
  payload: C2BPayload,
): Promise<Confirmation> {
  const { rows } = await query<{ tenant_id: string; shortcode: string }>(
    `select tenant_id, shortcode from mpesa_accounts where callback_secret = $1`,
    [secret],
  );
  const account = rows[0];
  if (!account) return { status: "rejected", reason: "Unknown callback address." };

  const transId = String(payload.TransID ?? "").trim();
  if (!transId) return { status: "rejected", reason: "No transaction id in the payload." };

  const shortcode = String(payload.BusinessShortCode ?? "").trim();
  if (shortcode && shortcode !== account.shortcode) {
    return { status: "rejected", reason: "That shortcode does not belong to this business." };
  }

  const amount = Number(payload.TransAmount ?? 0);
  const receivedAt = parseTransTime(payload.TransTime);
  const msisdn = String(payload.MSISDN ?? "");
  const name = payerName(payload) || "M-Pesa customer";
  const billRef = String(payload.BillRefNumber ?? "").trim();

  /* The receipt code is unique across all of Safaricom, which makes this the
   * same dedupe primitive the statement importer already uses. A callback
   * retried after a timeout therefore cannot post income twice. */
  const { rows: inserted } = await query<{ id: number }>(
    `insert into mpesa_events
       (tenant_id, trans_id, amount, msisdn, payer_name, bill_ref, short_code, trans_time, payload)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict (tenant_id, trans_id) do nothing
     returning id`,
    [account.tenant_id, transId, amount, msisdn, name, billRef, shortcode, receivedAt, payload],
  );

  if (!inserted.length) return { status: "duplicate", transId };

  if (!Number.isFinite(amount) || amount <= 0) {
    await query(`update mpesa_events set error = $2 where tenant_id = $1 and trans_id = $3`, [
      account.tenant_id,
      "No usable amount in the payload.",
      transId,
    ]);
    return { status: "rejected", reason: "No usable amount.", transId };
  }

  const match = await findOrder(account.tenant_id, { amount, msisdn, billRef, receivedAt });

  /* The payment is written into the seller's sync stream, which means it
   * reaches their phone through exactly the same path as everything else — no
   * separate channel, no second source of truth. */
  /* Decisive enough to settle an order, or only a lead for the seller to
   * confirm. The distinction is carried in the record itself rather than left
   * to whoever reads the confidence number: a settled payment names its order,
   * a lead only suggests one. */
  const settles = Boolean(match && match.confidence >= 0.9 && match.order);

  const paymentId = `pay_mpesa_${transId}`;
  const payment = {
    id: paymentId,
    ...(settles ? { orderId: match!.orderId } : {}),
    ...(match && !settles ? { suggestedOrderId: match.orderId } : {}),
    customerId: match?.customerId,
    customerName: name,
    method: "mpesa" as const,
    amount,
    reference: transId,
    state: "received" as const,
    receivedAt,
    matched: settles,
    source: "mpesa" as const,
    ...(match ? { confidence: match.confidence } : {}),
  };

  const ops: Parameters<typeof push>[2] = [
    { kind: "payment", id: paymentId, doc: payment, updatedAt: receivedAt },
  ];

  /* A confident match settles the order too. Anything less is left alone: the
   * app already has a screen for matching by hand, and a wrong auto-match is
   * worse than no match — it hides money under the wrong customer. */
  if (settles) {
    ops.push({
      kind: "order",
      id: match!.orderId,
      doc: { ...match!.order, paymentStatus: "paid" },
      updatedAt: receivedAt,
    });
  }

  await push(account.tenant_id, `mpesa:${transId}`, ops, "mpesa");

  await query(
    `update mpesa_events
        set payment_id = $2, matched_order = $3
      where tenant_id = $1 and trans_id = $4`,
    [account.tenant_id, paymentId, settles ? match!.orderId : null, transId],
  );
  await query(`update mpesa_accounts set last_event_at = now() where tenant_id = $1`, [
    account.tenant_id,
  ]);

  return {
    status: "posted",
    transId,
    paymentId,
    matchedOrder: settles ? match!.orderId : undefined,
    suggestedOrder: settles ? undefined : match?.orderId,
    confidence: match?.confidence,
  };
}

/* ------------------------------------------------------------------ *
 * Working out which order it was for
 * ------------------------------------------------------------------ */

interface Match {
  orderId: string;
  customerId?: string;
  confidence: number;
  order?: Record<string, unknown>;
}

/**
 * Matching a payment to an order.
 *
 * Three signals, in order of how much they are worth. The account reference is
 * decisive when the customer actually typed the order number — that is not a
 * coincidence. The paying phone number is strong. The amount alone is weak,
 * because two customers owing 2,500 on the same day is ordinary.
 *
 * The confidence comes back with the payment so the seller can see why, and
 * only a decisive match settles an order automatically.
 */
async function findOrder(
  tenantId: string,
  hint: { amount: number; msisdn: string; billRef: string; receivedAt: string },
): Promise<Match | null> {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query<{ id: string; doc: Record<string, unknown> }>(
      `select id, doc from records
        where tenant_id = $1 and kind = 'order' and deleted_at is null
          and doc->>'paymentStatus' in ('unpaid', 'partial', 'cod')
          and doc->>'status' <> 'cancelled'
        order by updated_at desc
        limit 300`,
      [tenantId],
    );
    if (!rows.length) return null;

    const { rows: customers } = await client.query<{ id: string; doc: Record<string, unknown> }>(
      `select id, doc from records
        where tenant_id = $1 and kind = 'customer' and deleted_at is null`,
      [tenantId],
    );

    const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
    const payerDigits = digits(hint.msisdn);
    // The last nine digits are the same however the number was written down.
    const tail = (value: string) => value.slice(-9);

    const byPhone = new Set(
      customers
        .filter((c) => payerDigits && tail(digits(c.doc.phone)) === tail(payerDigits))
        .map((c) => c.id),
    );

    const ref = hint.billRef.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

    let best: Match | null = null;

    for (const row of rows) {
      const order = row.doc;
      const code = String(order.code ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
      const total = orderTotal(order);
      const amountMatches = Math.abs(total - hint.amount) < 1;
      const phoneMatches = byPhone.has(String(order.customerId ?? ""));
      const refMatches = Boolean(ref && code && ref === code);

      let confidence = 0;
      if (refMatches && amountMatches) confidence = 0.98;
      else if (refMatches) confidence = 0.92;
      else if (phoneMatches && amountMatches) confidence = 0.9;
      else if (phoneMatches) confidence = 0.6;
      else if (amountMatches) confidence = 0.45;

      if (confidence === 0) continue;

      // A payment usually follows its order within a few days; a month-old
      // order matching only on amount is more likely a coincidence.
      const age = Math.abs(+new Date(hint.receivedAt) - +new Date(String(order.createdAt ?? "")));
      if (age > 30 * 86_400_000) confidence -= 0.15;

      if (!best || confidence > best.confidence) {
        best = {
          orderId: row.id,
          customerId: order.customerId as string | undefined,
          confidence: Math.round(confidence * 100) / 100,
          order,
        };
      }
    }

    /* Two open orders for the same amount cannot be told apart, so neither is
     * chosen — not even as a suggestion. Guessing here is how a seller's books
     * quietly go wrong, and a suggestion sitting on the wrong order is the kind
     * of thing that gets confirmed with a thumb without being read. */
    if (best && best.confidence < 0.9) {
      const ties = rows.filter(
        (row) => Math.abs(orderTotal(row.doc) - hint.amount) < 1,
      ).length;
      if (ties > 1) return null;
    }

    return best && best.confidence >= 0.45 ? best : null;
  });
}

/**
 * What the seller expects to receive for an order.
 *
 * Mirrors `sellerReceives` on the client: the delivery fee only counts when the
 * seller is the one charging it. With an independent boda paid at the door,
 * matching against the fee-inclusive total would never find the order.
 */
function orderTotal(order: Record<string, unknown>): number {
  const items = Array.isArray(order.items) ? (order.items as Record<string, unknown>[]) : [];
  const goods = items.reduce(
    (sum, item) => sum + Number(item.price ?? 0) * Number(item.qty ?? 0),
    0,
  );
  const settlement = String(order.deliverySettlement ?? "business_pays_rider");
  const collectsFee = settlement === "business_pays_rider" || settlement === "rider_collects";
  return goods - Number(order.discount ?? 0) + (collectsFee ? Number(order.deliveryFee ?? 0) : 0);
}

/** Payments that arrived but could not be tied to an order. */
export async function unmatchedEvents(tenantId: string) {
  return withTenant(tenantId, async (client) => {
    const { rows } = await client.query(
      `select trans_id, amount, payer_name, msisdn, bill_ref, trans_time, error
         from mpesa_events
        where tenant_id = $1 and matched_order is null
        order by received_at desc limit 100`,
      [tenantId],
    );
    return rows;
  });
}
