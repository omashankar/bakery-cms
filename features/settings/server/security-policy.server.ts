import "server-only";

import { getSettings } from "@/features/settings/server/settings.service";
import { defaultSecuritySettings } from "@/features/settings/lib/settings-utils";
import type { SecuritySettings } from "@/types/settings";

/**
 * The Security screen's policy fields, read where they are enforced.
 *
 * They were stored, validated and summarised, and grepping for any of them
 * across `lib/server/auth/` and `features/auth/` returned nothing. An owner who
 * set "max login attempts: 3" got a hardcoded ten-per-minute-per-IP throttle;
 * one who set a 15-minute session got a 15-minute access token and a 30-DAY
 * refresh token regardless. A cosmetic control is a nuisance; a cosmetic
 * SECURITY control tells someone their shop is protected in a way it is not.
 *
 * Never throws: an auth path must not fail because a settings read did. The
 * defaults are the shipped policy, so falling back to them is the same answer
 * a fresh install gets rather than "no protection".
 */
export async function getSecurityPolicy(): Promise<SecuritySettings> {
  try {
    const settings = (await getSettings()) as { security?: Partial<SecuritySettings> };
    return { ...defaultSecuritySettings, ...(settings.security ?? {}) };
  } catch {
    return defaultSecuritySettings;
  }
}

/**
 * How many failed sign-ins an address may make before it is throttled.
 *
 * Clamped rather than trusted: the schema constrains future writes and this
 * value gates authentication, so a stored 0 (locking everyone out) or a stored
 * 10_000 (no protection at all) must not be honoured just because it once got
 * past a validator.
 */
export function loginAttemptLimit(policy: SecuritySettings): number {
  const configured = Number(policy.maxLoginAttempts);
  if (!Number.isFinite(configured)) return defaultSecuritySettings.maxLoginAttempts;
  return Math.min(20, Math.max(3, Math.trunc(configured)));
}

/**
 * The access-token lifetime, as a JWT TTL string.
 *
 * `JWT_ACCESS_TTL` stays authoritative when it is set: an operator pinning it
 * through the environment is making a deployment decision, and a shop admin
 * should not silently override it. Otherwise the configured value wins.
 *
 * Clamped to a range where both ends are still a session: a one-minute token
 * would log the admin out mid-form, and a one-year one is not a timeout.
 */
export function accessTokenTtl(policy: SecuritySettings): string {
  if (process.env.JWT_ACCESS_TTL?.trim()) return process.env.JWT_ACCESS_TTL.trim();

  const configured = Number(policy.sessionTimeoutMinutes);
  if (!Number.isFinite(configured)) return `${defaultSecuritySettings.sessionTimeoutMinutes}m`;

  return `${Math.min(1440, Math.max(5, Math.trunc(configured)))}m`;
}
