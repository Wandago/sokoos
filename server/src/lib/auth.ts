import { randomBytes, randomInt } from "node:crypto";
import { query, withAccount } from "../db/pool.js";
import { normalisePhone } from "./phone.js";
import { sameHash, sha256 } from "./hash.js";

/**
 * Signing in with a phone number and a six-digit code.
 *
 * No password. A password on a shared Android phone in a shop, typed with one
 * hand while a customer waits, is worse security than a code that expires in
 * five minutes — people reuse it, write it down, or pick 1234. The code goes to
 * the number that already is their identity in this market.
 *
 * Three things make the code safe enough to be short: it is hashed at rest, it
 * expires, and it is counted so it cannot be guessed in the window it lives.
 */

const CODE_TTL_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const SESSION_DAYS = 60;
/** No more than this many codes per number per window, to stop SMS billing abuse. */
const MAX_CODES_PER_HOUR = 5;

export interface RequestedCode {
  phone: string;
  expiresAt: string;
  /** Only ever returned outside production, so a developer can sign in. */
  devCode?: string;
}

export class TooManyRequests extends Error {
  constructor() {
    super("Too many codes requested for this number. Wait a few minutes.");
    this.name = "TooManyRequests";
  }
}

export class BadCode extends Error {
  constructor(message = "That code is wrong or has expired.") {
    super(message);
    this.name = "BadCode";
  }
}

export async function requestCode(rawPhone: string): Promise<RequestedCode> {
  const phone = normalisePhone(rawPhone);

  const { rows: recent } = await query<{ n: number }>(
    `select count(*)::int as n from login_codes
      where phone = $1 and created_at > now() - interval '1 hour'`,
    [phone],
  );
  if ((recent[0]?.n ?? 0) >= MAX_CODES_PER_HOUR) throw new TooManyRequests();

  // Six digits, from a cryptographic source rather than Math.random.
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();

  // Any earlier unconsumed code for this number stops working the moment a new
  // one is sent, so two codes are never valid at once.
  await query(
    `update login_codes set consumed_at = now()
      where phone = $1 and consumed_at is null`,
    [phone],
  );
  await query(
    `insert into login_codes (phone, code_hash, expires_at) values ($1, $2, $3)`,
    [phone, sha256(code), expiresAt],
  );

  // Delivery is somebody else's job — an SMS aggregator, or WhatsApp. This
  // service only decides what the code is and whether it is still valid.
  await deliverCode(phone, code);

  return {
    phone,
    expiresAt,
    ...(process.env.NODE_ENV === "production" ? {} : { devCode: code }),
  };
}

/**
 * Where the code actually goes.
 *
 * Not wired to a provider, because that needs an account this build does not
 * have. It logs, so the flow is complete and testable end to end, and the one
 * function to replace is this one.
 */
async function deliverCode(phone: string, code: string) {
  const sender = process.env.SMS_WEBHOOK_URL;
  if (!sender) {
    if (process.env.NODE_ENV !== "test") {
      console.log(`[sms] ${phone}: your SokoOS code is ${code}`);
    }
    return;
  }
  await fetch(sender, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ to: phone, message: `Your SokoOS code is ${code}` }),
  }).catch((error) => {
    // A failed send must not lose the code — the seller can ask for another.
    console.error("[sms] delivery failed", error);
  });
}

export interface Session {
  token: string;
  accountId: string;
  expiresAt: string;
  /** The businesses this person can act for. Usually exactly one. */
  tenants: { id: string; name: string; slug: string; role: string }[];
}

export async function verifyCode(
  rawPhone: string,
  code: string,
  opts: { name?: string; userAgent?: string } = {},
): Promise<Session> {
  const phone = normalisePhone(rawPhone);

  const { rows } = await query<{
    id: string;
    code_hash: string;
    attempts: number;
  }>(
    `select id, code_hash, attempts from login_codes
      where phone = $1 and consumed_at is null and expires_at > now()
      order by created_at desc limit 1`,
    [phone],
  );

  const candidate = rows[0];
  if (!candidate) throw new BadCode();
  if (candidate.attempts >= MAX_ATTEMPTS) {
    await query("update login_codes set consumed_at = now() where id = $1", [candidate.id]);
    throw new BadCode("Too many wrong tries. Ask for a new code.");
  }

  if (!sameHash(candidate.code_hash, sha256(String(code).trim()))) {
    await query("update login_codes set attempts = attempts + 1 where id = $1", [candidate.id]);
    throw new BadCode();
  }

  await query("update login_codes set consumed_at = now() where id = $1", [candidate.id]);

  // First sign-in creates the account. There is no separate registration step,
  // because asking someone to remember which one they did is a way to lose them.
  const { rows: accounts } = await query<{ id: string }>(
    `insert into accounts (phone, name)
     values ($1, $2)
     on conflict (phone) do update set last_seen_at = now()
     returning id`,
    [phone, opts.name?.trim() || "New seller"],
  );
  const accountId = accounts[0]!.id;

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await query(
    `insert into sessions (account_id, token_hash, expires_at, user_agent)
     values ($1, $2, $3, $4)`,
    [accountId, sha256(token), expiresAt, opts.userAgent?.slice(0, 300) ?? null],
  );

  return { token, accountId, expiresAt, tenants: await tenantsFor(accountId) };
}

export async function tenantsFor(accountId: string) {
  return withAccount(accountId, async (client) => {
    const { rows } = await client.query<{
      id: string;
      name: string;
      slug: string;
      role: string;
    }>(
      `select t.id, t.name, t.slug, m.role
         from memberships m
         join tenants t on t.id = m.tenant_id
        where m.account_id = $1 and t.suspended_at is null
        order by m.created_at`,
      [accountId],
    );
    return rows;
  });
}

export interface Caller {
  accountId: string;
  sessionId: string;
  tenants: { id: string; name: string; slug: string; role: string }[];
}

/** Resolves a bearer token to who is calling, or null. */
export async function callerFor(token: string | undefined): Promise<Caller | null> {
  if (!token) return null;
  const { rows } = await query<{ id: string; account_id: string }>(
    `update sessions set last_used_at = now()
      where token_hash = $1 and revoked_at is null and expires_at > now()
      returning id, account_id`,
    [sha256(token)],
  );
  const session = rows[0];
  if (!session) return null;
  return {
    accountId: session.account_id,
    sessionId: session.id,
    tenants: await tenantsFor(session.account_id),
  };
}

export async function signOut(token: string) {
  await query("update sessions set revoked_at = now() where token_hash = $1", [sha256(token)]);
}

/**
 * Creates the business itself. Separate from the account because one person can
 * run two shops, and because a business outlives the phone that started it.
 */
export async function createTenant(
  accountId: string,
  input: { name: string; industry?: string },
) {
  const base =
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "shop";

  // Slugs are public (they are the mini site address), so collisions are
  // resolved rather than rejected — the seller should not have to care.
  let slug = base;
  for (let n = 2; n < 200; n++) {
    const { rows } = await query("select 1 from tenants where slug = $1", [slug]);
    if (!rows.length) break;
    slug = `${base}-${n}`;
  }

  const { rows } = await query<{ id: string; slug: string }>(
    `insert into tenants (slug, name, industry) values ($1, $2, $3) returning id, slug`,
    [slug, input.name.trim(), input.industry ?? null],
  );
  const tenant = rows[0]!;

  await query(
    `insert into memberships (tenant_id, account_id, role) values ($1, $2, 'owner')`,
    [tenant.id, accountId],
  );
  await query(`insert into tenant_cursors (tenant_id) values ($1)`, [tenant.id]);

  return { id: tenant.id, slug: tenant.slug, name: input.name.trim() };
}
