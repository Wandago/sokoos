import { apiBase, call, getSession, syncConfigured } from "./client";

/**
 * The seller's own till, from the app's side.
 *
 * Worth being clear about what these calls do and do not do, because the whole
 * design turns on it: none of them move money. The customer pays the seller's
 * own Paybill or Till directly, exactly as they already do today, and the money
 * lands in the seller's account with nobody in between. What these calls buy is
 * that SokoOS gets *told* — so a payment appears in the books by itself instead
 * of being typed in from an SMS.
 *
 * The credentials go up once and never come back down. `TillStatus` is
 * deliberately made of things that are safe to show: a masked key so the seller
 * can confirm they pasted the right one, and the callback URLs they have to
 * paste into the Daraja portal.
 */

export interface TillStatus {
  connected: boolean;
  kind?: "paybill" | "till";
  shortcode?: string;
  environment?: "sandbox" | "production";
  /** Set once Safaricom has accepted the callback URLs. */
  registeredAt?: string | null;
  /** The last time a payment actually arrived — the only real proof it works. */
  lastEventAt?: string | null;
  /** Masked. Enough to recognise, not enough to use. */
  consumerKey?: string;
  confirmationUrl?: string;
  validationUrl?: string;
}

export interface TillCredentials {
  kind: "paybill" | "till";
  shortcode: string;
  consumerKey: string;
  consumerSecret: string;
  passkey?: string;
  environment: "sandbox" | "production";
}

/** Money that arrived without an obvious order behind it. */
export interface UnmatchedEvent {
  trans_id: string;
  amount: string | number;
  payer_name: string | null;
  msisdn: string | null;
  bill_ref: string | null;
  trans_time: string | null;
  error: string | null;
}

/**
 * Whether this build can talk to a till at all.
 *
 * With no API address and no session there is nowhere for Safaricom to call
 * back to, so the screen says so rather than showing a form that cannot work.
 */
export function tillAvailable() {
  return syncConfigured() && Boolean(getSession());
}

function tenantPath(suffix = "") {
  const session = getSession();
  if (!session) throw new Error("Sign in first.");
  return `/tenants/${session.tenantId}/mpesa${suffix}`;
}

function token() {
  return getSession()?.token;
}

export async function fetchTill(): Promise<TillStatus> {
  if (!tillAvailable()) return { connected: false };
  return call<TillStatus>(tenantPath(), {}, token());
}

export async function connectTill(credentials: TillCredentials): Promise<TillStatus> {
  return call<TillStatus>(
    tenantPath(),
    { method: "POST", body: JSON.stringify(credentials) },
    token(),
  );
}

/**
 * Asks Safaricom to start sending this seller's payments here.
 *
 * Separate from connecting on purpose. Registration can fail for reasons that
 * have nothing to do with the credentials — a shortcode not yet live, URLs
 * already registered to something else — and a seller who has just typed six
 * fields correctly should not be told those fields were wrong.
 */
export async function registerTill(): Promise<{ ok: boolean; detail?: unknown }> {
  return call(tenantPath("/register"), { method: "POST" }, token());
}

export async function fetchUnmatched(): Promise<UnmatchedEvent[]> {
  if (!tillAvailable()) return [];
  return call<UnmatchedEvent[]>(tenantPath("/unmatched"), {}, token());
}

/** Where Safaricom would call, for a seller reading the setup steps. */
export function callbackHost() {
  return apiBase || "";
}
