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
  it("becomes the access-token lifetime", () => {
    delete process.env.JWT_ACCESS_TTL;
    // Every session was 15 minutes whatever the screen said.
    expect(accessTokenTtl(policy({ sessionTimeoutMinutes: 45 }))).toBe("45m");
  });

  it("is clamped at both ends, because it gates authentication", () => {
    delete process.env.JWT_ACCESS_TTL;
    // A one-minute token logs the admin out mid-form; a one-year one is not a
    // timeout. The schema constrains future writes; this value is read on every
    // sign-in, so a stored extreme must not be honoured just for having been
    // stored once.
    expect(accessTokenTtl(policy({ sessionTimeoutMinutes: 1 }))).toBe("5m");
    expect(accessTokenTtl(policy({ sessionTimeoutMinutes: 999_999 }))).toBe("1440m");
    expect(accessTokenTtl(policy({ sessionTimeoutMinutes: NaN }))).toBe(
      `${defaultSecuritySettings.sessionTimeoutMinutes}m`,
    );
  });

  it("still lets the environment win", () => {
    // An operator pinning the TTL through the environment is making a
    // deployment decision, and a shop admin should not silently override it.
    process.env.JWT_ACCESS_TTL = "7m";
    expect(accessTokenTtl(policy({ sessionTimeoutMinutes: 45 }))).toBe("7m");
    delete process.env.JWT_ACCESS_TTL;
  });

  it("is what the sign-in path actually applies", () => {
    const service = code("features/auth/server/auth.service.ts");
    expect(service).toContain("accessTokenTtl(await getSecurityPolicy())");
    // Both the initial sign-in and the refresh rotation, so shortening the
    // timeout takes effect without waiting for a fresh login.
    expect(service.match(/accessTokenTtl\(await getSecurityPolicy\(\)\)/g)?.length).toBe(2);
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
    expect(page).toMatch(/disabled=\{notBuilt \|\| alwaysOn\}/);

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
