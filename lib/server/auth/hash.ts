import { createHash, randomInt } from "node:crypto";

/**
 * Fast one-way hashing for opaque tokens (refresh tokens, OTPs) that we only
 * ever compare by equality — SHA-256 is right here (bcrypt is for passwords,
 * where slowness is the point). We store the hash, never the raw value.
 */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Cryptographically-random 6-digit OTP as a zero-padded string. */
export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}
