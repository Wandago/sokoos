import { createHash, timingSafeEqual } from "node:crypto";

/** Used to fingerprint tokens and codes at rest — never anything reversible. */
export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/** Constant time, so a wrong value cannot be narrowed down by timing it. */
export function sameHash(a: string, b: string) {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}
