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
  } catch (error) {
    // Loud, because this silently downgrades the shop to the shipped policy.
    // A shop that had tightened its limits gets the defaults back with no
    // trace anywhere — the failure mode is invisible precisely where being
    // invisible is worst.
    console.error(
      `[security] policy read failed, falling back to defaults: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return defaultSecuritySettings;
  }
}

/**
 * How many sign-in ATTEMPTS an address may make per minute before it is
 * throttled.
 *
 * Not "failed" attempts, which is what this said and what the screen still
 * implies: `rateLimit` counts every POST to the login route from that IP,
 * successful ones included. Said plainly because the difference matters to a
 * shop behind one NAT — several staff signing in legitimately share the
 * budget.
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
 * The longest an access token may live, whatever the shop configures.
 *
 * `getSession` verifies the JWT and nothing else — no session-row read, no
 * revocation list — so an access token cannot be revoked before it expires.
 * That makes this number the REVOCATION LAG: the window in which "Revoke
 * session", "Log out everywhere" and a password change all report success while
 * a stolen token keeps working.
 *
 * The first version of this function let the configured timeout raise it, which
 * widened that window from 15 minutes to 60 by default — a security control
 * that made the shop less safe. It may only ever shorten it.
 */
const MAX_ACCESS_TTL_MINUTES = 15;

/**
 * The access-token lifetime, as a JWT TTL string.
 *
 * `JWT_ACCESS_TTL` stays authoritative when it is set: an operator pinning it
 * through the environment is making a deployment decision, and a shop admin
 * should not silently override it.
 *
 * A shop asking for a SHORTER session gets it. One asking for a longer one gets
 * the ceiling — the session still ends when they asked, enforced on the session
 * row by `sessionExpiredAt` below, but the unrevocable token stays short.
 */
export function accessTokenTtl(policy: SecuritySettings): string {
  if (process.env.JWT_ACCESS_TTL?.trim()) return process.env.JWT_ACCESS_TTL.trim();

  const configured = Number(policy.sessionTimeoutMinutes);
  if (!Number.isFinite(configured)) return `${MAX_ACCESS_TTL_MINUTES}m`;

  const minutes = Math.min(MAX_ACCESS_TTL_MINUTES, Math.max(5, Math.trunc(configured)));
  return `${minutes}m`;
}

/**
 * Whether a session started this long ago has run past the configured timeout.
 *
 * This is where "session timeout" actually means something. The access token is
 * deliberately capped above, so lengthening it cannot express a 4-hour session —
 * and the cookie's own expiry only governs a cooperating browser. Checked on
 * every refresh instead: the rotation is the moment a session either continues
 * or does not, and refusing there ends it for a real client without widening
 * the window for a replayed token.
 *
 * Clamped the same way the screen is: 5 minutes is the shortest usable session,
 * and a day is the longest that is still a timeout.
 */
export function sessionTimeoutMs(policy: SecuritySettings): number {
  const configured = Number(policy.sessionTimeoutMinutes);
  const minutes = Number.isFinite(configured)
    ? Math.min(1440, Math.max(5, Math.trunc(configured)))
    : defaultSecuritySettings.sessionTimeoutMinutes;
  return minutes * 60_000;
}
