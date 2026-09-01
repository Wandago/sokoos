import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

/**
 * Encrypting a seller's Daraja credentials.
 *
 * These are the keys to transacting on someone else's shortcode. Storing them
 * in plain columns would mean a database dump — a stolen backup, a misconfigured
 * replica, a support engineer with too much access — is enough to move money on
 * behalf of every seller on the platform.
 *
 * AES-256-GCM, so the ciphertext is authenticated: a value tampered with in the
 * database fails to decrypt rather than decrypting to something else. Each value
 * gets its own random nonce, which is why the same secret stored twice does not
 * produce the same ciphertext.
 *
 * The key lives outside the database, in the environment. That is the whole
 * point — if it sat in a table beside the data it protects, it would protect
 * nothing.
 */

const VERSION = "v1";

export class MissingKey extends Error {
  constructor() {
    super(
      "ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32",
    );
    this.name = "MissingKey";
  }
}

let cached: Buffer | null = null;

function key(): Buffer {
  if (cached) return cached;
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new MissingKey();

  // Accept a base64 32-byte key directly; anything else is hashed to length so
  // a weak passphrase at least produces a well-formed key rather than a crash.
  const decoded = Buffer.from(raw, "base64");
  cached = decoded.length === 32 ? decoded : createHash("sha256").update(raw).digest();
  return cached;
}

/** For tests, which swap keys to prove a wrong one cannot decrypt. */
export function resetKeyCache() {
  cached = null;
}

export function encrypt(plaintext: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), nonce);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Version first, so the format can change later without guessing.
  return [VERSION, nonce.toString("base64"), tag.toString("base64"), body.toString("base64")].join(
    ".",
  );
}

export function decrypt(envelope: string): string {
  const [version, nonce, tag, body] = envelope.split(".");
  if (version !== VERSION || !nonce || !tag || !body) {
    throw new Error("Unreadable encrypted value.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(nonce, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(body, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * A secret for a callback URL.
 *
 * Long and from a cryptographic source, because Daraja does not sign its
 * callbacks and this is therefore the only thing standing between a seller's
 * books and anyone who can guess a URL.
 */
export function callbackSecret() {
  return randomBytes(24).toString("base64url");
}

/** Shows a credential without revealing it, for the seller's own settings screen. */
export function maskSecret(value: string) {
  if (value.length <= 8) return "••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}
