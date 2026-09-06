import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Hashing an admin's password.
 *
 * scrypt rather than a dependency, for the same reason the rest of this
 * server avoids them where the standard library already does the job:
 * one fewer package to audit and pin. It is deliberately slow — that is
 * the entire point of a password hash — and salted per value, so two
 * admins who happen to pick the same password do not produce the same
 * hash.
 */

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, KEY_LENGTH);
  return ["scrypt", salt.toString("base64"), derived.toString("base64")].join(".");
}

export function verifyPassword(password: string, stored: string): boolean {
  const [version, saltB64, hashB64] = stored.split(".");
  if (version !== "scrypt" || !saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** A well-formed hash of nothing real, so a lookup miss costs the same time as a hit. */
export const DUMMY_HASH = hashPassword("no-such-admin-0000000000");
