import { readdirSync, readFileSync } from "node:fs";
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

/**
 * The two api modules that must NOT report a 401, with the reason.
 *
 * An exemption has to be argued for, which is the point of naming them here
 * rather than leaving them out of a list nobody would notice them missing from.
 */
/** Every `*-api.ts` under the given roots, found on disk rather than listed. */
function apiModulesUnder(roots: string[]): string[] {
  const found: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        walk(path);
      } else if (entry.name.endsWith("-api.ts")) {
        found.push(path);
      }
    }
  };

  for (const root of roots) walk(root);
  return found.sort();
}

/** Every write-reporting helper, found on disk rather than named. */
function reportHelpersUnder(roots: string[]): string[] {
  const found: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        walk(path);
      } else if (/^report-.*write\.ts$/.test(entry.name)) {
        found.push(path);
      }
    }
  };

  for (const root of roots) walk(root);
  return found.sort();
}

const EXEMPT = [
  // The refresh endpoint IS the thing a 401 asks about. Reporting from here
  // would call the confirmer, which calls refresh, which reports again.
  "features/auth/lib/auth-api.ts",
  // A storefront customer getting a delivery quote has no admin session to end,
  // and marking one would put a sign-in dialog over a shopper's checkout.
  "features/checkout/lib/quote-api.ts",
];

describe("the store that tracks the session", () => {
  beforeEach(async () => {
    const { markSessionRenewed, setExpiryConfirmer } = await import(
      "@/features/auth/lib/session-expiry"
    );
    markSessionRenewed();
    setExpiryConfirmer(() => {});
  });

  it("does not end a session on a 401 — it asks the server", async () => {
    /**
     * The access token is short-lived and runs out on its own every few
     * minutes; that is the routine condition the refresh flow exists to
     * repair. Publishing "expired" for it put a password prompt over a
     * perfectly live session and — because the heartbeat stops once expired —
     * killed the renewal that would have fixed it.
     */
    const { noteAuthStatus, sessionState, setExpiryConfirmer } = await import(
      "@/features/auth/lib/session-expiry"
    );

    let asked = 0;
    setExpiryConfirmer(() => {
      asked += 1;
    });

    expect(noteAuthStatus(401)).toBe(true);
    expect(asked, "the 401 was not put to the server").toBe(1);
    expect(sessionState(), "a 401 ended the session by itself").toBe("active");
  });

  it("asks about nothing else", async () => {
    // A 403 is a permission this account does not have — a real answer from a
    // live session. A 5xx is the server failing, which signing in cannot fix.
    const { noteAuthStatus, sessionState, setExpiryConfirmer } = await import(
      "@/features/auth/lib/session-expiry"
    );

    let asked = 0;
    setExpiryConfirmer(() => {
      asked += 1;
    });

    for (const status of [200, 403, 404, 429, 500, 503]) {
      expect(noteAuthStatus(status), `${status} was read as an expiry`).toBe(false);
    }

    expect(asked, "a status other than 401 provoked a renewal").toBe(0);
    expect(sessionState()).toBe("active");
  });

  it("stops asking once the answer is in", async () => {
    // A failed page load fires a 401 from every panel on it. One question is
    // enough; the rest would each mint a request against a dead session.
    const { markSessionExpired, noteAuthStatus, setExpiryConfirmer } = await import(
      "@/features/auth/lib/session-expiry"
    );

    let asked = 0;
    setExpiryConfirmer(() => {
      asked += 1;
    });

    markSessionExpired();
    noteAuthStatus(401);
    noteAuthStatus(401);

    expect(asked).toBe(0);
  });

  it("does not let the warning overwrite a session that has actually ended", async () => {
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

  it("measures idleness from the last RENEWAL, which is when the server's clock moved", async () => {
    /**
     * The warning used to predict from the last keystroke. The heartbeat renews
     * up to PRESENCE_WINDOW_MS after that, so the two clocks sat minutes apart
     * and the warning fired on a session nowhere near ending.
     */
    const { idleForMs, markSessionRenewed, markSessionExpiring } = await import(
      "@/features/auth/lib/session-expiry"
    );

    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(idleForMs(), "the idle clock never advanced").toBeGreaterThanOrEqual(20);

    // Only a renewal moves it — a warning must not, or the countdown would
    // reset itself every time it appeared.
    markSessionExpiring();
    expect(idleForMs()).toBeGreaterThanOrEqual(20);

    markSessionRenewed();
    expect(idleForMs(), "a renewal did not reset the idle clock").toBeLessThan(20);
  });

  it("tells its subscribers, and stops when they let go", async () => {
    const { subscribeToSession, markSessionExpired, markSessionRenewed, markSessionExpiring } =
      await import("@/features/auth/lib/session-expiry");

    const seen: string[] = [];
    const stop = subscribeToSession((next) => seen.push(next));

    markSessionExpiring();
    markSessionExpiring(); // no transition — must not fire twice
    markSessionExpired();
    stop();
    /**
     * A DIFFERENT state after unsubscribing.
     *
     * The first version published the state it was already in, which `publish`
     * early-returns on — so the assertion passed whether or not the unsubscribe
     * worked, and a leaked listener per admin page load would have gone unseen.
     */
    markSessionRenewed();

    expect(seen).toEqual(["expiring", "expired"]);
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

  it("predicts the warning from the SERVER's clock, not the last keystroke", () => {
    /**
     * The two are not the same instant. The heartbeat renews up to
     * PRESENCE_WINDOW_MS after the last input, so a prediction made from
     * `lastSeen` fires minutes early on a session with time left — and the
     * dialog then "checked" by renewing it, which held an unattended tab open
     * forever. `idleForMs()` is the time since the last successful refresh,
     * which is the moment the server's own `lastSeenAt` moved.
     *
     * Scoped to the watcher's body: the file mentions `lastSeen` legitimately
     * elsewhere, for the presence gate.
     */
    const source = stripComments(hook());
    const watch = source.slice(source.indexOf("const armWatch ="), source.indexOf("armWatch();"));

    expect(watch, "the watcher was not found").toContain("markSessionExpiring()");
    expect(watch, "the warning still predicts from the last keystroke").not.toContain("lastSeen");
    expect(watch).toContain("idleForMs()");
    expect(watch).toContain("WARN_BEFORE_MS");
  });

  it("does not let a stray click dismiss the warning without renewing anything", () => {
    /**
     * `markPresent` used to clear the warning. The listener is on `window`, so
     * the pointerdown that presses "Stay signed in" reached it first: the
     * dialog unmounted, the click never got to its handler, the server's clock
     * was never touched — and the admin believed they had kept the session
     * they had just lost.
     */
    const source = stripComments(hook());
    const markPresent = source.slice(
      source.indexOf("const markPresent ="),
      source.indexOf("const renew ="),
    );

    expect(markPresent, "the warning is cleared by mere presence again").not.toMatch(
      /markSession(Active|Renewed)/,
    );
  });

  it("clears the warning only when a renewal actually succeeded", () => {
    const source = stripComments(hook());
    const renewAt = source.indexOf("const renew =");
    // Searched FROM the declaration: `setExpiryConfirmer` also appears in the
    // import block above, and slicing to that gave an empty string that every
    // `toContain` would have passed.
    const renew = source.slice(renewAt, source.indexOf("setExpiryConfirmer(", renewAt));

    expect(renew.length, "the renew helper was not found").toBeGreaterThan(50);

    expect(renew).toMatch(/outcome === "renewed"[\s\S]{0,60}markSessionRenewed/);
  });
});

describe("the expiry countdown", () => {
  const guard = () => stripComments(read("features/auth/components/session-guard.tsx"));

  it("never renews the session by itself", () => {
    /**
     * `/api/auth/refresh` is a RENEWAL, not a read, so "asking the server for
     * the verdict" at zero was extending the very session it was warning
     * about. On an unattended tab the answer came back "renewed", the warning
     * cleared, the watcher re-fired seconds later, and it repeated about every
     * seventy seconds for as long as the tab stayed open — roughly twelve
     * hundred rotations a day, with the shop's idle timeout unreachable. That
     * is exactly the regression PRESENCE_WINDOW_MS exists to prevent.
     *
     * Renewing is now only ever a human pressing the button, which is itself
     * the presence the timeout is asking about.
     */
    const source = guard();
    const expiring = source.slice(
      source.indexOf("function ExpiringSoon"),
      source.indexOf("function SignInAgain"),
    );
    const timer = expiring.slice(expiring.indexOf("useEffect("), expiring.indexOf("const stay ="));

    expect(timer, "the countdown renews the session on its own").not.toContain("refreshSession");
    // The only caller left is the button's handler.
    expect(expiring.match(/refreshSession\(\)/g) ?? []).toHaveLength(1);
  });

  it("counts against the same clock the server uses", () => {
    const source = guard();
    const secondsLeft = source.slice(
      source.indexOf("function secondsLeft"),
      source.indexOf("function ExpiringSoon"),
    );

    expect(secondsLeft).toContain("idleForMs()");
    expect(secondsLeft).toContain("sessionTimeoutMinutes");
  });

  it("does not claim the page's data came back after a re-login", () => {
    /**
     * `router.refresh()` re-runs Server Components and deliberately PRESERVES
     * client state — and every admin screen here is a client component that
     * fetches in an effect on mount. The lists that emptied do not return on
     * their own, so saying they had would be this dialog reporting something
     * that did not happen.
     */
    const source = guard();

    expect(source).not.toContain("the data behind this dialog is real again");
    expect(source).toMatch(/reload to refresh/i);
  });

  it("writes the re-entry into the security log, like the login page does", () => {
    // A sign-in that does not appear in the log of sign-ins is worse than none.
    expect(guard()).toContain("recordLoginSuccess(user.email)");
  });
});

describe("signing in on the login page", () => {
  it("takes the expiry dialog down", () => {
    /**
     * The state is module-level and survives a client-side navigation, so an
     * admin who took the dialog's own "sign in on the login page instead" link
     * and signed in successfully was pushed back to a dashboard still covered
     * by the non-dismissible dialog. The one route out led straight back in.
     */
    const source = stripComments(read("features/auth/pages/login-form-page.tsx"));
    const success = source.slice(
      source.indexOf("const user = await loginRequest"),
      source.indexOf("} catch"),
    );

    expect(success, "a successful sign-in leaves the dialog up").toMatch(
      /markSession(Renewed|Active)\(\)/,
    );
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
    /**
     * BOTH reporters, discovered on disk.
     *
     * There are two, and the first version of this test named only one — so
     * `report-settings-write.ts`, the untouched twin that still said "reset on
     * this device only", passed unnoticed. On the settings screens, which is
     * exactly where an admin sits still long enough to be timed out.
     *
     * Comments stripped: these files EXPLAIN the "on this device only" wording
     * several paragraphs above where they emit it, so matching the raw text
     * finds the docstring and any ordering check means nothing.
     */
    const reporters = reportHelpersUnder(["apps", "features"]);
    expect(reporters.length, "no write reporters found").toBeGreaterThan(1);

    for (const path of reporters) {
      const source = stripComments(read(path));
      const expiredAt = source.indexOf('sessionState() !== "expired"');
      const consults = expiredAt > -1 || source.includes('sessionState() === "expired"');

      expect(consults, `${path} cannot tell an ended session from a refused value`).toBe(true);

      /**
       * Scoped to the FUNCTION that emits it.
       *
       * Searching the whole file for a guard before the message found the one
       * belonging to the sibling function above — so removing the guard from
       * `reportSettingsReset` left this green, which is the file-scoped
       * weakness this very test exists to close, reproduced inside it.
       */
      const bodies = source.split(/export function /).slice(1);
      expect(bodies.length, `${path} exports nothing to check`).toBeGreaterThan(0);

      for (const body of bodies) {
        if (!body.includes("on this device only")) continue;
        const name = body.slice(0, body.indexOf("(")).trim();
        const guardAt = Math.max(
          body.indexOf("reportedAsSignedOut()"),
          body.indexOf('sessionState() === "expired"'),
        );

        expect(
          guardAt,
          `${path} — ${name}() says "on this device only" without ever asking whether the session ended`,
        ).toBeGreaterThan(-1);
        expect(
          guardAt,
          `${path} — ${name}() reaches the misleading message first`,
        ).toBeLessThan(body.indexOf("on this device only"));
      }
    }
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
    /**
     * DISCOVERED, not listed.
     *
     * The first version of this test held a hand-written array of fourteen
     * paths — and the repo has nineteen. It enforced completeness inside each
     * file it happened to name while being blind to whole modules, which is
     * exactly how site-layout-api (header, footer, appearance, SEO),
     * settings-api and security-center-api slipped through: a list cannot
     * notice what is missing from itself.
     */
    const MODULES = apiModulesUnder(["features", "apps/admin"]).filter(
      (path) => !EXEMPT.some((exempt) => path.endsWith(exempt)),
    );

    expect(MODULES.length, "no api modules found — has the layout changed?").toBeGreaterThan(12);

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
