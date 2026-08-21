import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Signing out is an access control, and the only thing that performs it is
 * `clearAuthCookies()` at the end of the server's `logout`.
 *
 * `clearDemoSession()` removes a localStorage marker that gates nothing: there
 * is no proxy check on `/admin`, `AdminLayoutShell` performs no session check,
 * and every `/api/*` endpoint reads the cookie. The refresh cookie lasts thirty
 * days, and the shell re-mints an access token from it on the next visit.
 *
 * All three sign-out paths did `await logoutRequest().catch(() => undefined)`
 * and then redirected to the login page unconditionally — one of them with a
 * comment saying the redirect happens "regardless so the user is never stuck".
 * Landing on the login form IS the report. On a shared or public machine the
 * admin walked away believing they were signed out, and the next person to type
 * /admin/orders was signed in as them.
 */
const api = vi.hoisted(() => ({ logoutRequest: vi.fn(async () => undefined) }));
const session = vi.hoisted(() => ({ clearDemoSession: vi.fn() }));

vi.mock("@/features/auth/lib/auth-api", () => api);
vi.mock("@/features/auth/lib/session", () => session);

const { signOutOfThisDevice, SIGN_OUT_FAILED } = await import(
  "@/features/auth/lib/sign-out"
);

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.clearAllMocks());

describe("signing out of this device", () => {
  it("reports true, and clears the local marker, when the server did it", async () => {
    api.logoutRequest.mockResolvedValueOnce(undefined);

    await expect(signOutOfThisDevice()).resolves.toBe(true);
    expect(session.clearDemoSession).toHaveBeenCalledOnce();
  });

  it("reports false when the request never reached the server", async () => {
    api.logoutRequest.mockRejectedValueOnce(new Error("offline"));

    await expect(signOutOfThisDevice()).resolves.toBe(false);
  });

  it("reports false when the server refused", async () => {
    // `post()` throws on any non-2xx, so a 500 arrives here as a rejection.
    api.logoutRequest.mockRejectedValueOnce(new Error("500"));

    await expect(signOutOfThisDevice()).resolves.toBe(false);
  });

  it("leaves the browser in ONE honest state on failure", async () => {
    api.logoutRequest.mockRejectedValueOnce(new Error("offline"));

    await signOutOfThisDevice();

    // Half-clearing is worse than not clearing: the cookies still sign every
    // request, so the marker saying "signed out" would be the only thing wrong.
    expect(session.clearDemoSession).not.toHaveBeenCalled();
  });

  it("has something to say to the person it could not sign out", async () => {
    expect(SIGN_OUT_FAILED.title).toMatch(/could not sign you out/i);
    expect(SIGN_OUT_FAILED.description).toMatch(/still signed in/i);
  });
});

/**
 * Three call sites, because fixing one and leaving the others is how this
 * codebase's twins get made. Two of them were byte-for-byte the same line.
 */
describe("every sign-out path", () => {
  const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

  const SITES = [
    "apps/admin/profile/components/logout-confirm-dialog.tsx",
    "features/auth/components/auth-logout-menu-item.tsx",
    "apps/admin/settings/components/security-settings-page.tsx",
  ];

  for (const path of SITES) {
    it(`${path} does not redirect on a sign-out that failed`, () => {
      const text = source(path);

      expect(text).toContain("signOutOfThisDevice()");
      // The shape that was wrong, in all three.
      expect(text).not.toContain("logoutRequest().catch(() => undefined)");
      // The redirect is guarded by the outcome.
      expect(text).toMatch(/if \(!signedOut(?:Everywhere)?\)|if \(!selfLoggedOut\)/);
    });
  }

  it("does not blame the other devices for this one still being signed in", () => {
    const text = source("apps/admin/settings/components/security-settings-page.tsx");
    const fn = text.slice(text.indexOf("async function confirmLogoutEverywhere"));
    const body = fn.slice(0, fn.indexOf("\n  }"));

    // The self-logout failure has to be reported, and reported FIRST — the
    // error this used to show read "Signed out here, but some devices may still
    // be signed in" while this browser was the one still signed in.
    const failureBranch = body.indexOf("if (!selfLoggedOut)");
    const otherDevices = body.indexOf("some devices may still be signed in");
    const redirect = body.indexOf("router.push(routes.auth.login)");

    expect(failureBranch).toBeGreaterThan(-1);
    expect(failureBranch).toBeLessThan(otherDevices);
    expect(failureBranch).toBeLessThan(redirect);
  });
});

/**
 * The same rule, on two more screens: a write the server refused must not be
 * left looking saved, and a file must not be produced from figures that were
 * never loaded.
 */
describe("what a refused write leaves behind", () => {
  const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

  it("the admin profile undoes its local write, like the store beside it", () => {
    const text = source("features/auth/lib/admin-profile.ts");

    // `ensureAdminConfigHydrated` returns early once settled, so nothing
    // re-reads the server for the rest of the session — the rejected value sat
    // in the cache and the next mount loaded it as BOTH the working copy and
    // `saved`, leaving the form clean and Save disabled.
    expect(text).toContain("const stillOurs = localStorage.getItem(STORAGE_KEY)");
    expect(text).toContain("window.dispatchEvent(new Event(ADMIN_PROFILE_UPDATED_EVENT))");
    // The shape that was wrong: local write, then fire the request as the
    // return value with nothing undone.
    expect(text).not.toContain("if (!write(next)) return false;\n  return replaceAdminProfileRequest(next);");
  });

  it("the reports export refuses when nothing was loaded", () => {
    const text = source("apps/admin/reports/components/reports-page.tsx");
    const fn = text.slice(text.indexOf("function handleExport()"));
    const body = fn.slice(0, fn.indexOf("\n  }"));

    // Every figure falls back to zero for the SCREEN, which the header
    // explains. A CSV carries no header and outlives the toast.
    expect(body).toContain("if (!analytics)");
    expect(body.indexOf("if (!analytics)")).toBeLessThan(body.indexOf("exportReportsCsv("));
    expect(text).toContain("disabled={!analytics}");
  });
});

/**
 * Changing the password revokes every refresh token for that admin — including
 * the one in the cookie of the browser that just did it, deliberately, and named
 * as such in the security policy. No new pair is issued.
 *
 * So the heartbeat's next refresh fails silently and the access cookie expires
 * on its own within five to fifteen minutes: the CMS starts 401-ing under an
 * admin who was told "use your new password the next time you sign in" and had
 * no reason to expect the panel to stop working. The revocation is right; the
 * sentence was wrong.
 */
describe("changing the password", () => {
  const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

  it("says it signs you out everywhere, and does it here too", () => {
    const page = source("apps/admin/profile/components/change-password-page.tsx");

    expect(page).toContain("await signOutOfThisDevice()");
    expect(page).toContain("Password updated — sign in again");
    expect(page).toContain("signs you out on every device, including this one");
    // The sentence that was untrue.
    expect(page).not.toContain("Use your new password the next time you sign in.");
  });

  it("states the rule the server actually applies", () => {
    const page = source("apps/admin/profile/components/change-password-page.tsx");
    const rules = page.slice(page.indexOf("const RULES = ["), page.indexOf("const meetsServerRule"));

    // The checklist was wrong in both directions: it demanded mixed case and a
    // symbol the server never asks for, and never mentioned the digit it does.
    expect(rules).toContain("Letters and numbers");
    expect(rules).not.toContain("At least one symbol");
    expect(rules).not.toContain("Upper & lowercase letters");
  });

  it("gates the button on that rule instead of on length alone", () => {
    const page = source("apps/admin/profile/components/change-password-page.tsx");

    expect(page).toContain("current.length > 0 && meetsServerRule(next)");
    expect(page).not.toContain("current.length > 0 && next.length >= 8 && confirm === next");
  });

  it("removes the session rows, as the reset path already did", () => {
    const service = source("features/auth/server/auth.service.ts");
    const fn = service.slice(service.indexOf("export async function changePassword"));
    const body = fn.slice(0, fn.indexOf("\n}"));

    // The Security Center lists devices from the surviving rows, and a row's
    // expiresAt is the 30-day refresh TTL — a device that never comes back never
    // self-cleans.
    expect(body).toContain("await repo.revokeRefreshTokensByUser(userId);");
    expect(body).toContain("await repo.deleteSessionsByUser(userId);");
  });
});
