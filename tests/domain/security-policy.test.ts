// @vitest-environment node
//
// jose signs with WebCrypto, and jsdom hands it a Uint8Array from a different
// realm — "payload must be an instance of Uint8Array". Nothing in this file
// needs a DOM: it is pure policy functions and source assertions.
/**
 * The Security screen's policy fields, and whether anything obeys them.
 *
 * Every one of them was stored, validated and summarised, and grepping any of
 * them across `lib/server/auth/` and `features/auth/` returned nothing. A
 * cosmetic control is a nuisance; a cosmetic SECURITY control tells an owner
 * their shop is protected in a way it is not, which is the one place this
 * codebase's signature bug does real harm.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  accessTokenTtl,
  loginAttemptLimit,
  sessionTimeoutMs,
} from "@/features/settings/server/security-policy.server";
import { defaultSecuritySettings } from "@/features/settings/lib/settings-utils";
import type { SecuritySettings } from "@/types/settings";

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function code(relativePath: string): string {
  return source(relativePath)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const policy = (over: Partial<SecuritySettings> = {}): SecuritySettings => ({
  ...defaultSecuritySettings,
  ...over,
});

describe("the configured session timeout", () => {
  it("shortens the access token, and only ever shortens it", () => {
    delete process.env.JWT_ACCESS_TTL;
    // Every session was 15 minutes whatever the screen said — so a shop
    // asking for less now gets less.
    expect(accessTokenTtl(policy({ sessionTimeoutMinutes: 5 }))).toBe("5m");
    expect(accessTokenTtl(policy({ sessionTimeoutMinutes: 10 }))).toBe("10m");
  });

  it("is clamped at both ends, because it gates authentication", () => {
    delete process.env.JWT_ACCESS_TTL;
    // A one-minute token logs the admin out mid-form. The upper end is the
    // revocation lag, so it is a ceiling rather than the configured value —
    // see the regression test below.
    expect(accessTokenTtl(policy({ sessionTimeoutMinutes: 1 }))).toBe("5m");
    expect(accessTokenTtl(policy({ sessionTimeoutMinutes: 999_999 }))).toBe("15m");
    // A non-numeric stored value must not produce `NaNm`, which jose would
    // reject at signing time — on every sign-in.
    expect(accessTokenTtl(policy({ sessionTimeoutMinutes: NaN }))).toBe("15m");
  });

  it("still lets the environment win", () => {
    // An operator pinning the TTL through the environment is making a
    // deployment decision, and a shop admin should not silently override it.
    process.env.JWT_ACCESS_TTL = "7m";
    expect(accessTokenTtl(policy({ sessionTimeoutMinutes: 45 }))).toBe("7m");
    delete process.env.JWT_ACCESS_TTL;
  });

  it("reaches the signed token, not just the call site", async () => {
    // The grep version of this counted call sites, and `code()` strips only
    // whole-line comments — so a trailing `// TODO: restore accessTokenTtl(…)`
    // satisfied it while the behaviour was gutted. Sign a token and read it.
    process.env.JWT_ACCESS_SECRET = "test-secret-for-ttl-assertions";
    const { signAccessToken } = await import("@/lib/server/auth/jwt");
    const { decodeJwt } = await import("jose");

    const token = await signAccessToken(
      { sub: "u1", role: "owner", email: "a@b.com" },
      accessTokenTtl(policy({ sessionTimeoutMinutes: 7 })),
    );
    const claims = decodeJwt(token);

    expect((claims.exp as number) - (claims.iat as number)).toBe(7 * 60);
  });

  it("applies it on the refresh rotation too", () => {
    const service = code("features/auth/server/auth.service.ts");
    // Shortening the timeout should take effect without waiting for a fresh
    // login — the rotation re-reads the policy.
    expect(service).toContain("accessTokenTtl(await getSecurityPolicy())");
    expect(service).toContain("accessTokenTtl(policy)");
  });
});

describe("the configured login-attempt limit", () => {
  it("is the number the throttle uses", () => {
    // An owner who set three got a hardcoded ten.
    expect(loginAttemptLimit(policy({ maxLoginAttempts: 7 }))).toBe(7);
  });

  it("is clamped, because a stored zero would lock everyone out", () => {
    expect(loginAttemptLimit(policy({ maxLoginAttempts: 0 }))).toBe(3);
    expect(loginAttemptLimit(policy({ maxLoginAttempts: 10_000 }))).toBe(20);
    expect(loginAttemptLimit(policy({ maxLoginAttempts: NaN }))).toBe(
      defaultSecuritySettings.maxLoginAttempts,
    );
  });

  it("reaches the login controller", () => {
    const controller = code("features/auth/server/auth.controller.ts");
    expect(controller).toContain("loginAttemptLimit(policy)");
    // Not the hardcoded ten it used to be.
    expect(controller).not.toMatch(/rateLimit\(`login:\$\{ctx\.ip\}`, \{ limit: 10,/);
  });
});

describe("the password rule matches the sentence next to it", () => {
  it("requires what the Security screen says it requires", async () => {
    const { changePasswordSchema } = await import(
      "@/features/auth/server/auth.validators"
    );

    // The screen said "8+ chars with mixed case and numbers" and the rule was a
    // bare length check, so eight identical letters passed while the admin read
    // that mixed case and digits were required. Stating a protection you do not
    // apply is the failure, not the missing characters.
    const ok = (password: string) =>
      changePasswordSchema.safeParse({
        currentPassword: "whatever",
        newPassword: password,
        confirmPassword: password,
      }).success;

    expect(ok("Abcdefg1")).toBe(true);
    expect(ok("aaaaaaaa")).toBe(false);
    expect(ok("AAAAAAAA")).toBe(false);
    expect(ok("Abcdefgh")).toBe(false);
    expect(ok("Abc1")).toBe(false);
  });

  it("is not applied to LOGIN, where an existing password must keep working", async () => {
    const { loginSchema } = await import("@/features/auth/server/auth.validators");
    // Tightening the rule must not lock out an account created under the old
    // one — that would turn a copy fix into an outage.
    expect(loginSchema.safeParse({ email: "a@b.com", password: "old" }).success).toBe(true);
  });
});

describe("controls that nothing enforces", () => {
  it("are disabled and say so, rather than looking like protection", () => {
    const page = code("apps/admin/settings/components/security-settings-page.tsx");

    // A switch an owner can flip is a promise that flipping it changes
    // something. These two change nothing, so they cannot be flipped.
    expect(page).toContain("Not built yet — sign-in asks for a password only.");
    expect(page).toContain("Not built yet — no email is sent on a new sign-in.");
    // The call sites, not the definition: the regex matched `PolicySwitch`
    // itself, so both props could be dropped from every usage and this still
    // passed. Each switch has to carry its own flag.
    expect(page).toMatch(/description="Not built yet — sign-in asks for a password only\."\s*\r?\n\s*notBuilt/);
    expect(page).toMatch(/description="Not built yet — no email is sent on a new sign-in\."\s*\r?\n\s*notBuilt/);
    expect(page).toMatch(/description="Always on: 8\+ characters with mixed case and a number\."\s*\r?\n\s*alwaysOn/);

    // And the old copy that implied they worked is gone.
    expect(page).not.toContain("OTP verification on login (demo toggle).");
    expect(page).not.toContain("Email alert when a new device signs in.");
  });

  it("no longer claims a password rule it does not apply", () => {
    const page = code("apps/admin/settings/components/security-settings-page.tsx");
    expect(page).not.toContain("Require 8+ chars with mixed case and numbers.");
    expect(page).toContain("Always on: 8+ characters with mixed case and a number.");
  });
});

describe("the activity log", () => {
  it("ships no fabricated entries", async () => {
    const { seedActivityLog } = await import("@/features/settings/lib/settings-utils");

    // Three demo rows — "Homepage builder snapshot published", "Theme colors
    // and border radius updated" — attributed to "admin" with plausible
    // timestamps, MERGED with the real server audit trail and rendered
    // identically. A fresh shop opened its audit log and read three things that
    // never happened, indistinguishable from the ones that did.
    expect(seedActivityLog).toEqual([]);
  });

  it("still shows the real server trail", () => {
    const page = code("apps/admin/settings/components/activity-settings-page.tsx");
    expect(page).toContain("fetchAuditLogs");
    expect(page).toContain("auditToActivity");
  });
});

describe("the header sentence an owner scans", () => {
  it("does not claim a second factor that does not exist", () => {
    const page = code("apps/admin/settings/components/security-settings-page.tsx");

    // A shop with `twoFactorEnabled: true` stored — saved before the toggle was
    // disabled — read "2FA on" in the header while the switch below it said
    // "Not built yet". Two contradictory statements on one screen, and the
    // false one was the summary.
    expect(page).not.toContain('2FA ${saved.twoFactorEnabled ? "on" : "off"}');
    // What IS enforced takes the place.
    expect(page).toContain("${saved.maxLoginAttempts} login attempts/min");
  });

  it("still reads the SAVED policy, not the draft", () => {
    const page = code("apps/admin/settings/components/security-settings-page.tsx");
    // Dragging the timeout slider restated the header as though the change were
    // already in effect, on the one screen where what is enforced is the whole
    // question.
    expect(page).toContain("${saved.sessionTimeoutMinutes}m timeout");
    expect(page).not.toContain("${settings.sessionTimeoutMinutes}m timeout");
  });
});

describe("the regressions the first attempt introduced", () => {
  it("never lets the configured timeout LENGTHEN the access token", () => {
    delete process.env.JWT_ACCESS_TTL;

    // `getSession` verifies the JWT and nothing else — no session-row read, no
    // revocation list — so the token's lifetime IS the revocation lag: the
    // window in which "Revoke session", "Log out everywhere" and a password
    // change all report success while a stolen token keeps working.
    //
    // The first version of this let the configured timeout raise it from 15
    // minutes to 60 by default. A security control that made the shop less safe.
    expect(accessTokenTtl(policy({ sessionTimeoutMinutes: 60 }))).toBe("15m");
    expect(accessTokenTtl(policy({ sessionTimeoutMinutes: 1440 }))).toBe("15m");

    // Shortening is the direction that helps, so it still works.
    expect(accessTokenTtl(policy({ sessionTimeoutMinutes: 5 }))).toBe("5m");
  });

  it("expresses the timeout on the session instead", () => {
    expect(sessionTimeoutMs(policy({ sessionTimeoutMinutes: 60 }))).toBe(60 * 60_000);
    expect(sessionTimeoutMs(policy({ sessionTimeoutMinutes: 1 }))).toBe(5 * 60_000);
    expect(sessionTimeoutMs(policy({ sessionTimeoutMinutes: 99_999 }))).toBe(1440 * 60_000);
  });

  it("enforces it where a session continues or does not", () => {
    const service = code("features/auth/server/auth.service.ts");
    // The rotation is the moment a session either continues or ends, so
    // refusing there ends it for a real client without giving a replayed token
    // a single extra second.
    expect(service).toContain("sessionTimeoutMs(policy)");
    expect(service).toMatch(/if \(idleMs > sessionTimeoutMs\(policy\)\)/);
    expect(service).toContain("repo.deleteSession(claims.sid)");
    // And a continuing session restarts the idle window.
    expect(service).toContain("repo.touchSession(claims.sid)");
  });

  it("does not dead-end a password reset", () => {
    const page = code("features/auth/pages/reset-password-form-page.tsx");

    // The card said "letters and numbers" while the server also wanted an
    // uppercase letter, and the client rule was `minLength: 8` — so a password
    // typed to match the sentence on screen was refused, to somebody who is
    // already locked out and holding a ten-minute OTP.
    expect(page).not.toContain("Use at least 8 characters with letters and numbers.");
    expect(page).toContain("an uppercase letter, a lowercase letter and a number");
    // Checked client-side too, so the answer arrives without a round trip.
    // The `validate` KEY, not just the regex body: renaming it to anything
    // else leaves those characters on the page and stops react-hook-form
    // ever calling it, which is the whole point of the assertion.
    expect(page).toMatch(
      /validate: \(value: string\) =>[\s\S]{0,200}\/\[A-Z\]\/\.test\(value\)/,
    );
  });

  it("lets a field error reach the user at all", () => {
    const api = code("features/auth/lib/auth-api.ts");
    // A validation failure puts the useful sentence in `errors` and leaves
    // `message` as the constant "Validation failed", so every auth screen
    // showed a toast naming no rule.
    expect(api).toContain("json?.errors");
    expect(api).toMatch(/fieldMessage \|\| json\?\.message/);
  });

  it("does not advertise a password rule the server never accepted", () => {
    const notice = code("features/auth/components/auth-demo-notice.tsx");
    expect(notice).not.toContain("password 6+ characters");
    expect(notice).toContain("8+ with mixed case and a number");
  });
});
