import { randomBytes } from "node:crypto";
import { query } from "../db/pool.js";
import { sha256 } from "./hash.js";
import { DUMMY_HASH, verifyPassword } from "./password.js";

/**
 * Signing in to the operator console.
 *
 * Separate from `auth.ts` on purpose: a seller's session proves they can act
 * for one business, and an admin's session proves they can act for every
 * business on the platform. Those are different enough powers that mixing
 * the two tables — or worse, the two kinds of token — would make a bug in
 * one place a bug in both.
 */

const SESSION_DAYS = 14;

export class BadCredentials extends Error {
  constructor() {
    super("Wrong email or password.");
    this.name = "BadCredentials";
  }
}

export interface AdminSession {
  token: string;
  adminId: string;
  name: string;
  email: string;
  expiresAt: string;
}

export async function adminLogin(email: string, password: string): Promise<AdminSession> {
  const { rows } = await query<{ id: string; password_hash: string; name: string; email: string }>(
    `select id, password_hash, name, email from admin_users where email = $1`,
    [email.trim().toLowerCase()],
  );
  const admin = rows[0];

  // Run a hash comparison either way, so an email that does not exist takes
  // the same time to reject as a wrong password for one that does — the
  // difference is otherwise exactly what an attacker enumerating admin
  // emails is measuring for.
  const ok = verifyPassword(password, admin?.password_hash ?? DUMMY_HASH);
  if (!admin || !ok) throw new BadCredentials();

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await query(
    `insert into admin_sessions (admin_id, token_hash, expires_at) values ($1, $2, $3)`,
    [admin.id, sha256(token), expiresAt],
  );
  await query(`update admin_users set last_seen_at = now() where id = $1`, [admin.id]);

  return { token, adminId: admin.id, name: admin.name, email: admin.email, expiresAt };
}

export interface AdminCaller {
  adminId: string;
  name: string;
  email: string;
}

export async function adminCallerFor(token: string | undefined): Promise<AdminCaller | null> {
  if (!token) return null;
  const { rows } = await query<{ admin_id: string; name: string; email: string }>(
    `update admin_sessions s set last_used_at = now()
       from admin_users u
      where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now()
        and u.id = s.admin_id
      returning s.admin_id, u.name, u.email`,
    [sha256(token)],
  );
  const session = rows[0];
  if (!session) return null;
  return { adminId: session.admin_id, name: session.name, email: session.email };
}

export async function adminSignOut(token: string) {
  await query("update admin_sessions set revoked_at = now() where token_hash = $1", [sha256(token)]);
}
