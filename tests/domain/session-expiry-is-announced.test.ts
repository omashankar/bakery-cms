import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

/**
 * An expired session has to be VISIBLE, and it was not.
 *
 * The server ends a session — idle past the shop's timeout, revoked, or the
 * account disabled — deletes the row and answers 401. Nothing else happened.
 * The refresh cookie stayed in the browser, and `proxy.ts` gates /admin on that
 * cookie's presence alone, so the person was never sent to the login page.
 * `refreshSession` returned a boolean that `useSessionRefresh` discarded with
 * `void`. And every `*-api.ts` maps a non-ok response to `null`/`false`, on
 * purpose, so the caller can tell "no data" from "bad data" — which meant an
 * admin sat on a fully rendered panel that emptied out one list at a time,
 * while each save reported "saved on this device only — the server rejected
 * it". They found out by losing work.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

describe("the store that tracks the session", () => {
  beforeEach(async () => {
    const { markSessionActive } = await import("@/features/auth/lib/session-expiry");
    markSessionActive();
  });

  it("starts out believing the session is fine", async () => {
    const { sessionState } = await import("@/features/auth/lib/session-expiry");
    expect(sessionState()).toBe("active");
  });

  it("treats a 401 as the end of the session, and nothing else", async () => {
    const { noteAuthStatus, sessionState, markSessionActive } = await import(
      "@/features/auth/lib/session-expiry"
    );

    // A 403 is a permission this account does not have — a real answer from a
    // live session. A 500 is the server failing, which signing out cannot fix.
    for (const status of [200, 403, 404, 429, 500, 503]) {
      expect(noteAuthStatus(status), `${status} was read as an expiry`).toBe(false);
      expect(sessionState()).toBe("active");
    }

    expect(noteAuthStatus(401)).toBe(true);
    expect(sessionState()).toBe("expired");
    markSessionActive();
  });

  it("does not let the warning overwrite an session that has actually ended", async () => {
    const { markSessionExpired, markSessionExpiring, sessionState } = await import(
      "@/features/auth/lib/session-expiry"
    );

    markSessionExpired();
    // The countdown is a prediction and can still be running when the server's
    // verdict lands. Downgrading here would replace the dialog asking for a
    // password with one offering to keep a session that is already gone.
    markSessionExpiring();

    expect(sessionState()).toBe("expired");
  });

  it("tells its subscribers, so a 401 in any module reaches the one dialog", async () => {
    const { subscribeToSession, noteAuthStatus, markSessionActive } = await import(
      "@/features/auth/lib/session-expiry"
    );

    const seen: string[] = [];
    const stop = subscribeToSession((next) => seen.push(next));

    noteAuthStatus(401);
    noteAuthStatus(401); // already expired — must not fire twice
    markSessionActive();
    stop();
    markSessionActive();

    expect(seen).toEqual(["expired", "active"]);
  });
});

describe("the server, when a session ends", () => {
  const service = () => read("features/auth/server/auth.service.ts");

  it("clears the cookies rather than only the database row", () => {
    /**
     * `clearAuthCookies()` ran in exactly one place — `logout`. Every other way
     * a session can end deleted the row and threw, leaving the browser holding
     * a refresh cookie that `proxy.ts` reads as "signed in".
     */
    const source = service();
    const endSession = source.slice(
      source.indexOf("async function endSession"),
      source.indexOf("export async function refresh"),
    );

    expect(endSession, "the browser is left holding a session cookie").toContain(
      "await clearAuthCookies()",
    );
  });

  it("routes every definitive end through it", () => {
    const source = service();

    for (const reason of [
      "Invalid refresh token",
      "Refresh token is no longer valid",
      "Account unavailable",
      "Session timed out",
    ]) {
      expect(source, `"${reason}" still ends the session without clearing it`).toContain(
        `endSession(`,
      );
      const at = source.indexOf(`"${reason}"`);
      expect(at, `"${reason}" is no longer raised`).toBeGreaterThan(-1);
      // The reason has to be the ARGUMENT to endSession, not a bare throw.
      const line = source.slice(source.lastIndexOf("\n", at), at);
      expect(line, `"${reason}" is thrown directly, so its cookies survive`).toContain(
        "endSession(",
      );
    }
  });
});

describe("the client heartbeat", () => {
  const hook = () => read("features/auth/lib/use-session-refresh.ts");

  it("reads the answer instead of discarding it", () => {
    const source = hook();

    expect(source, "the outcome is thrown away again").not.toMatch(/void refreshSession\(\);/);
    expect(source).toContain("markSessionExpired()");
  });

  it("does not sign anyone out because the server was unreachable", () => {
    /**
     * The old boolean conflated "this session is over" with "the request never
     * landed". Only the first may end a session: throwing an admin out
     * mid-edit for a dropped packet is a worse failure than the one being
     * fixed, and the next tick asks again anyway.
     */
    const source = hook();
    const expiredAt = source.indexOf('outcome === "expired"');

    expect(expiredAt, "expiry is no longer distinguished").toBeGreaterThan(-1);
    expect(source).not.toMatch(/outcome === "unreachable"[\s\S]{0,80}markSessionExpired/);
  });

  it("stops asking once the session is over", () => {
    // A heartbeat against a dead session is a request every few minutes for as
    // long as the tab stays open, and the answer cannot change until somebody
    // signs in.
    const source = hook();
    const tick = source.slice(source.indexOf("const tick ="), source.indexOf("tick(false);"));

    expect(tick).toContain('sessionState() === "expired"');
  });

  it("warns before the timeout rather than after it", () => {
    const source = hook();

    expect(source).toContain("WARN_BEFORE_MS");
    expect(source).toContain("markSessionExpiring()");
    // Derived from the shop's own setting, read fresh each round — the same
    // rule the heartbeat's delay follows.
    expect(source).toContain("getSecuritySettings().sessionTimeoutMinutes");
  });
});

describe("a write refused because the session ended", () => {
  it("is not reported as saved on this device", () => {
    /**
     * "…on this device only — the server rejected it" tells the admin the
     * change survived locally and invites a reload to compare, which signs
     * them out of the very tab holding it. The server did not reject the
     * value; it did not know who was asking.
     */
    // Comments stripped first: this file EXPLAINS the "on this device only"
    // wording several paragraphs above where it emits it, so matching the raw
    // text finds the docstring and the ordering check means nothing.
    const source = stripComments(read("apps/admin/lib/report-write.ts"));
    const expiredAt = source.indexOf('sessionState() === "expired"');
    const deviceOnlyAt = source.indexOf("on this device only");

    expect(expiredAt, "the write report cannot tell an expiry apart").toBeGreaterThan(-1);
    expect(deviceOnlyAt).toBeGreaterThan(-1);
    expect(expiredAt, "the misleading message is reached first").toBeLessThan(deviceOnlyAt);
  });

  it("was noticed at EVERY place the module reads a response", () => {
    /**
     * Counted, not merely present.
     *
     * `toContain("noteAuthStatus(res.status)")` passed with one call in a file
     * that checks `res.ok` in ten places — deleting nine left it green, which
     * is the shape of guard this codebase keeps producing. A module that
     * notices the expiry on its list endpoint and misses it on its save is
     * exactly the case that produces the wrong toast.
     */
    const MODULES = [
      "features/admin-config/lib/admin-config-api.ts",
      "features/audit/lib/audit-api.ts",
      "features/catalog/lib/catalog-api.ts",
      "features/commerce/lib/commerce-api.ts",
      "features/commerce/lib/invoice-settings-api.ts",
      "features/content/lib/content-api.ts",
      "features/inquiries/lib/inquiries-api.ts",
      "features/inquiries/lib/newsletter-api.ts",
      "features/orders/lib/orders-api.ts",
      "features/reviews/lib/reviews-api.ts",
      "apps/admin/commerce/lib/customers-api.ts",
      "apps/admin/commerce/lib/inventory-api.ts",
      "apps/admin/communications/lib/communications-api.ts",
      "apps/admin/media/lib/media-api.ts",
    ];

    for (const path of MODULES) {
      // Comments stripped: several of these EXPLAIN why the `res.ok` check
      // matters, and counting those would let a real site go unnoticed.
      const source = stripComments(read(path));
      const checks = (source.match(/res\.ok/g) ?? []).length;
      const noted = (source.match(/noteAuthStatus\(res\.status\)/g) ?? []).length;

      expect(checks, `${path} reads no responses — is the path still right?`).toBeGreaterThan(0);
      expect(noted, `${path} checks res.ok ${checks}× but reports a 401 ${noted}×`).toBe(checks);
    }
  });
});
