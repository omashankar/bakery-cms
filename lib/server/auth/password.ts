import bcrypt from "bcryptjs";

/**
 * Password hashing. bcryptjs (pure JS) avoids native build issues on Windows.
 * Cost 10 is the standard balance of security vs. login latency.
 */
const SALT_ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
