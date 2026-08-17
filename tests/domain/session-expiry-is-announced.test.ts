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
/**
 * Every file that makes a request, found by what it DOES.
 *
 * Discovery by filename failed three times over. First it was a hand-written
 * array of fourteen paths in a repo with nineteen `*-api.ts` modules. Then it
 * knew `*-api.ts` but not `*-client.ts`, so the two builders, the CMS pages and
 * the products module were invisible. Then `payment-gateway-settings.ts`, which
 * matches neither name, went unnoticed while holding two admin writes. A naming
 * convention is not a property; calling `fetch` is.
 *
 * `(?<![.\w])fetch\(` so `section.fetch()` and `opts.fetch()` — injected
 * callbacks, not requests — are not counted as either.
 */
function requestMakersUnder(roots: string[]): string[] {
  const found: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        walk(path);
        continue;
      }
      if (!/\.tsx?$/.test(entry.name) || /\.(test|spec)\./.test(entry.name)) continue;
      const source = stripComments(readFileSync(join(process.cwd(), path), "utf8"));
      if (/(?<![.\w])fetch\(/.test(source)) found.push(path);
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
  // Runs on the SERVER and calls WhatsApp, not this app. There is no browser
  // session here to have ended.
  "features/communications/server/whatsapp-client.server.ts",
];

/**
 * The storefront, whole.
 *
 * A shopper has no admin session, and marking one expired would drop a
 * password dialog over a checkout. Kept as a prefix rather than a file list
 * because the reason applies to the surface, not to individual files.
 */
const STOREFRONT = "apps/website/";

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
    expect(sessionState(), "a 401 ended the session by itself").not.toBe("expired");
    /**
     * And it says so SYNCHRONOUSLY.
     *
     * The write reporters read this state on the very next line of a refused
     * write. Leaving it "active" until the round trip answered made their
     * guard dead on the ordinary path: the admin was told "saved on this
     * device only — the server rejected it", and the sign-in dialog landed on
     * top of that a moment later, contradicting it and advising a reload that
     * would destroy the unsaved edits the dialog promises are safe.
     */
    expect(sessionState(), "the question left no trace for the reporters").toBe("checking");
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

  it("hands back an undo, so the confirmer cannot outlive the layout", async () => {
    /**
     * The callback is module-level and the shell registers it in an effect. Left
     * registered after that effect is torn down, it outlives the admin layout:
     * an admin who navigates to the storefront leaves a live confirmer behind,
     * and a 401 from any module the two surfaces share then renews the ADMIN
     * session from a page with no admin on it — the unattended renewal this
     * whole feature exists to prevent, through a second door.
     */
    const { markSessionRenewed, noteAuthStatus, setExpiryConfirmer } = await import(
      "@/features/auth/lib/session-expiry"
    );

    let asked = 0;
    const forget = setExpiryConfirmer(() => {
      asked += 1;
    });

    noteAuthStatus(401);
    expect(asked).toBe(1);

    /**
     * Back to "active" between the two calls, or this proves nothing.
     *
     * The first 401 leaves the store in "checking", and `noteAuthStatus` early-
     * returns from that state — so without this the second call was a no-op and
     * the count below stayed at 1 whether or not the unregister worked. The
     * assertion read as proof and was a tautology.
     */
    markSessionRenewed();

    forget();
    noteAuthStatus(401);
    expect(asked, "the confirmer kept answering after its owner unmounted").toBe(1);
  });

  it("does not let a departing layout unregister the one that replaced it", async () => {
    // React runs the new effect before the old cleanup on a remount. Clearing
    // unconditionally would leave the LIVE shell with no confirmer at all, and
    // every 401 after that would go unanswered in silence.
    const { noteAuthStatus, setExpiryConfirmer } = await import(
      "@/features/auth/lib/session-expiry"
    );

    const forgetFirst = setExpiryConfirmer(() => {});
    let second = 0;
    setExpiryConfirmer(() => {
      second += 1;
    });

    forgetFirst();
    noteAuthStatus(401);

    expect(second, "the old cleanup silenced the new confirmer").toBe(1);
  });

  it("has no back door that changes the answer without telling anyone", async () => {
    /**
     * `resetSessionTracking` assigned `state` directly rather than publishing.
     * A subscriber — the dialog — would have gone on rendering "expired" while
     * `sessionState()` answered "active", and the next real renewal would then
     * publish nothing, because `publish` early-returns when the state already
     * matches. The dialog would have stayed up forever, and the one call that
     * could remove it would have been the one that could not.
     *
     * Anything that writes `state` must go through `publish`.
     */
    const source = stripComments(read("features/auth/lib/session-expiry.ts"));

    /**
     * Not anchored to the start of a line.
     *
     * `/^\s*state = /gm` missed every assignment with anything in front of it
     * on the same line — and `if (…) x = y;` is this very file's house style,
     * so the back door the check exists to close was the shape it could not
     * see.
     */
    const assignments = [...source.matchAll(/(?<![.\w])state\s*=(?!=)/g)];

    expect(
      assignments.map((m) => source.slice(Math.max(0, (m.index ?? 0) - 30), (m.index ?? 0) + 20)),
      "something sets the state without notifying subscribers",
    ).toHaveLength(1);

    /**
     * And the one that remains is INSIDE publish, bounded by publish's own
     * body. Slicing from `function publish` to the end of file was satisfied by
     * an assignment in any function declared after it.
     */
    const publishAt = source.indexOf("function publish");
    expect(publishAt, "publish was not found").toBeGreaterThan(-1);
    const publishBody = source.slice(publishAt, source.indexOf("\n}", publishAt));

    expect(publishBody, "the one assignment is not the one inside publish").toMatch(
      /(?<![.\w])state\s*=(?!=)/,
    );
  });

  it("offers no way to assert a session is fine without the server saying so", async () => {
    /**
     * `markSessionActive` published "active" AND reset the idle clock, and had
     * no callers left. Unused would be harmless; the danger is the name — the
     * next person to reach for the obvious one would have told the warning that
     * the server had just renewed a session it had not.
     */
    const store = await import("@/features/auth/lib/session-expiry");

    expect(Object.keys(store)).not.toContain("markSessionActive");
    expect(store.markSessionRenewed, "the honest one went too").toBeTypeOf("function");
  });

  it("can ask again after a question that never came back", async () => {
    /**
     * The store wedged. A refresh that never landed left the state at
     * "checking", and `noteAuthStatus` declined to ask again while it READ
     * "checking" — so nothing could re-ask for the life of the tab, and every
     * write went on reporting "checking whether you are still signed in" about
     * a question nobody was asking, on a session that was probably fine.
     */
    const { markQuestionUnanswered, noteAuthStatus, sessionState, setExpiryConfirmer } =
      await import("@/features/auth/lib/session-expiry");

    let asked = 0;
    setExpiryConfirmer(() => {
      asked += 1;
    });

    noteAuthStatus(401);
    expect(asked).toBe(1);
    expect(sessionState()).toBe("checking");

    // A second 401 while the first question is genuinely in flight asks nothing
    // more — one question is enough for a page full of failing panels.
    noteAuthStatus(401);
    expect(asked, "every failing panel put its own question to the server").toBe(1);

    markQuestionUnanswered();
    noteAuthStatus(401);

    expect(asked, "an unanswered question silenced every later one").toBe(2);
    expect(sessionState(), "an unanswered question invented an answer").toBe("checking");
  });

  it("takes a successful request as proof the session is alive", async () => {
    /**
     * The only evidence that arrives on its own. Without it a "checking" left
     * by an unanswered question sits there while the admin works normally —
     * every request succeeding, every write still saying we are not sure who
     * they are.
     */
    const { markQuestionUnanswered, noteAuthStatus, sessionState, setExpiryConfirmer } =
      await import("@/features/auth/lib/session-expiry");

    setExpiryConfirmer(() => {});
    noteAuthStatus(401);
    markQuestionUnanswered();
    expect(sessionState()).toBe("checking");

    expect(noteAuthStatus(200), "a success was reported as a refusal").toBe(false);
    expect(sessionState(), "a successful request did not clear the doubt").toBe("active");
  });

  it("does not let a successful request reset the idle clock", async () => {
    /**
     * A 2xx on an admin endpoint proves someone is signed in. It does NOT move
     * the server's `lastSeenAt` — only a refresh does — so treating it as a
     * renewal would push the warning countdown forward on a session the server
     * is still counting down, and the admin would lose the minute's notice this
     * feature exists to give them.
     */
    const { idleForMs, markSessionRenewed, noteAuthStatus } = await import(
      "@/features/auth/lib/session-expiry"
    );

    markSessionRenewed();
    await new Promise((resolve) => setTimeout(resolve, 25));
    const before = idleForMs();

    noteAuthStatus(200);

    expect(idleForMs(), "a plain success was treated as a renewal").toBeGreaterThanOrEqual(before);
  });

  it("does not let a stale question suppress the warning", async () => {
    /**
     * The warning yields to a question in flight — right, because an answer is
     * on its way. It must NOT yield to a "checking" nobody is pursuing: that is
     * not better information, and suppressing the countdown for it takes away
     * the admin's one chance to keep the session.
     */
    const { markQuestionUnanswered, markSessionExpiring, noteAuthStatus, sessionState, setExpiryConfirmer } =
      await import("@/features/auth/lib/session-expiry");

    setExpiryConfirmer(() => {});
    noteAuthStatus(401);

    markSessionExpiring();
    expect(sessionState(), "a prediction overwrote a question in flight").toBe("checking");

    markQuestionUnanswered();
    markSessionExpiring();
    expect(sessionState(), "a stale question kept the warning off screen").toBe("expiring");
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

  it("does not let the warning bury a question already put to the server", async () => {
    /**
     * The watcher ticks every ten seconds, so it will fire while a 401's
     * question is still in flight. Overwriting "checking" with a prediction
     * would take the reporters' honest "checking whether you are still signed
     * in" away and put a countdown over it — a guess replacing an answer that
     * is already on its way.
     */
    const { noteAuthStatus, markSessionExpiring, sessionState, setExpiryConfirmer } = await import(
      "@/features/auth/lib/session-expiry"
    );

    setExpiryConfirmer(() => {});
    noteAuthStatus(401);
    expect(sessionState()).toBe("checking");

    markSessionExpiring();

    expect(sessionState(), "a prediction overwrote a question in flight").toBe("checking");
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

    /**
     * UNCONDITIONALLY.
     *
     * Plain containment cannot tell "always clears" from "clears only when
     * something happens to be true" — and a cookie left behind on any path is
     * a browser the proxy keeps waving into /admin, which is the entire defect.
     * The call must sit at the function's own statement level.
     */
    expect(endSession, "the browser is left holding a session cookie").toMatch(
      /\n {2}await clearAuthCookies\(\);/,
    );
  });

  it("routes every definitive end through it", () => {
    // Comments stripped: this file DISCUSSES `endSession(` and the reasons by
    // name in its docstrings, and anchoring on the first occurrence of a reason
    // string found the prose rather than the throw.
    const source = stripComments(service());

    for (const reason of [
      "Invalid refresh token",
      "Refresh token is no longer valid",
      "Account unavailable",
      "Session timed out",
    ]) {
      // (No file-wide `toContain("endSession(")` here: repeated once per
      // reason it asserted the same thing four times and mentioned none of
      // them. The per-reason check below is the whole point.)
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
    /**
     * The PROPERTY, not one spelling of its opposite.
     *
     * This forbade the literal `outcome === "unreachable" … markSessionExpired`.
     * Appending `else markSessionExpired();` to the outcome chain reintroduces
     * the defect exactly — a 500 or a dropped packet drops the password dialog
     * over an admin mid-edit — and never spells the word, so it passed.
     *
     * The rule is: within the chain that reads the outcome, the ONLY way to
     * reach `markSessionExpired` is a branch that tests for "expired".
     */
    const source = stripComments(hook());
    const renewAt = source.indexOf("const renew =");
    expect(renewAt, "the outcome chain was not found").toBeGreaterThan(-1);
    const chain = source.slice(renewAt, source.indexOf("setExpiryConfirmer(", renewAt));

    expect(chain, "expiry is no longer distinguished").toContain('outcome === "expired"');

    for (const call of chain.matchAll(/markSessionExpired\(\)/g)) {
      const guard = chain.slice(0, call.index ?? 0);
      const branch = guard.slice(guard.lastIndexOf("outcome"));
      expect(
        branch,
        "markSessionExpired is reachable from a branch that does not test for expiry",
      ).toMatch(/^outcome === "expired"/);
    }
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
    /**
     * Every presence path, not just `markPresent`'s own body.
     *
     * Sliced to that function, the same defect one line away passed: putting
     * `markSessionRenewed()` into `onFocus`, or into the listener registration
     * beside `markPresent`, clears the warning and resets the client's idle
     * clock off a bare pointerdown with no server round trip — the admin
     * believes they kept a session the server is still counting down.
     *
     * So: nothing that a human's mere presence triggers may claim a renewal.
     */
    const source = stripComments(hook());
    const paths = [
      ["const markPresent =", "const renew ="],
      ["const onFocus =", "const onVisibility ="],
      ["const onVisibility =", "window.addEventListener"],
      ["const PRESENCE_EVENTS", "return () => {"],
    ];

    for (const [start, end] of paths) {
      const from = source.indexOf(start);
      expect(from, `${start} was not found — has the hook been restructured?`).toBeGreaterThan(-1);
      const region = source.slice(from, source.indexOf(end, from));

      expect(
        region,
        `${start} claims a renewal off mere presence, with no server round trip`,
      ).not.toMatch(/markSession(Renewed|Active)/);
    }
  });

  it("actually calls the undo when it tears down", () => {
    /**
     * The store hands back an unregister, and a test proves the unregister
     * works — neither of which matters if the shell never calls it. The
     * mechanism and its wiring are two separate things to get wrong, and only
     * the first had a guard.
     */
    const source = stripComments(hook());
    const cleanupAt = source.indexOf("return () => {");

    expect(cleanupAt, "the effect no longer cleans up at all").toBeGreaterThan(-1);

    /**
     * UNCONDITIONALLY.
     *
     * Requiring only that the text appear somewhere after the cleanup opens
     * would pass for `if (somethingElse) forgetConfirmer();` — a cleanup that
     * runs sometimes leaves the callback registered the rest of the time, which
     * is the whole defect. The call must sit at the cleanup's own statement
     * level, with nothing branching in front of it.
     */
    const cleanup = source.slice(cleanupAt);
    expect(cleanup, "the confirmer is unregistered only under some condition").toMatch(
      /return \(\) => \{\s*forgetConfirmer\(\);/,
    );

    expect(
      cleanup,
      "the confirmer is left registered after the layout unmounts",
    ).toContain("forgetConfirmer()");
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
    /**
     * And SAYS SO when nothing was learned.
     *
     * The store cannot tell an unanswered question from one still in flight
     * unless the hook tells it, and without that it refuses to let anything ask
     * again — for the life of the tab. The store's own behaviour has a test;
     * this is the wiring that reaches it, which is a separate thing to get
     * wrong and did not have one.
     */
    expect(renew, "an unanswered refresh leaves the store believing it is still asking").toContain(
      "markQuestionUnanswered()",
    );
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
    expect(expiring.length, "ExpiringSoon was not found").toBeGreaterThan(200);

    const stayAt = expiring.indexOf("const stay =");
    expect(stayAt, "the button's handler was not found").toBeGreaterThan(-1);
    const timer = expiring.slice(0, stayAt);

    /**
     * Nothing that can REACH the network, not just the one function name.
     *
     * Forbidding the literal `refreshSession` left every indirection open — a
     * fetch, an import alias, the confirmer, a helper. The property under test
     * is "this timer does not talk to the server", so the check has to be about
     * talking to the server.
     */
    for (const reach of ["refreshSession", "fetch(", "confirmExpiry", "noteAuthStatus", "renew("]) {
      expect(timer, `the countdown reaches the server via ${reach}`).not.toContain(reach);
    }

    /**
     * And the blocklist is not the whole check.
     *
     * A helper declared outside ExpiringSoon — `async function askTheServer()
     * { return refreshSession(); }` — defeats every name above and the count
     * below, because neither looks outside the component. So the timer must
     * call NOTHING declared in this file except the state setters it needs:
     * anything else is a route out that no list of names can enumerate.
     */
    const declared = [...source.matchAll(/(?:function|const) (\w+)\s*[=(]/g)].map((m) => m[1]);
    const allowed = new Set(["secondsLeft", "setLeft", "setChecking", "ExpiringSoon"]);

    for (const name of declared) {
      if (allowed.has(name)) continue;
      expect(
        timer,
        `the countdown calls ${name}(), which is a route to the server no blocklist can enumerate`,
      ).not.toMatch(new RegExp(`(?<![.\\w])${name}\\(`));
    }

    // And exactly one caller survives in the whole component: the button's.
    expect(expiring.match(/refreshSession\(\)/g) ?? []).toHaveLength(1);
    expect(expiring.slice(stayAt), "the button no longer renews").toContain("refreshSession()");
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
    /**
     * The CLAIM, not one dead sentence.
     *
     * This forbade the exact string "the data behind this dialog is real
     * again", which no longer appears anywhere — so it could only fail if
     * someone retyped that one phrase, and any other wording making the same
     * promise sailed through. What must not happen is the success message
     * telling the admin their data is back when nothing refetched it.
     */
    const source = guard();
    const success = source.slice(
      source.indexOf('toast.success("Signed back in"'),
      source.indexOf("} catch"),
    );

    expect(success.length, "the re-login success message was not found").toBeGreaterThan(40);
    expect(success, "the dialog claims the page's data came back on its own").not.toMatch(
      /(data|lists|figures)[^"]{0,40}(back|real|refreshed|reloaded|up to date)/i,
    );
    expect(success, "the admin is not told how to get the data back").toMatch(/reload/i);
  });

  it("writes the re-entry into the security log, and lets the server correct it", () => {
    /**
     * A sign-in missing from the log of sign-ins is worse than none — but
     * `recordLoginSuccess` writes an INVENTED session row: an id from the
     * clock, a blank IP, `isCurrent: true`, and every real row demoted. The
     * login page gets away with it because the navigation that follows
     * re-hydrates from the server. This dialog does not navigate, so it has to
     * ask for the correction itself.
     */
    const source = guard();

    expect(source).toContain("recordLoginSuccess(user.email)");
    expect(source, "the invented session row is left in the cache").toContain(
      "fetchSecurityCenter()",
    );
    expect(source).toContain("persistServerSecurityCenter(state)");
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

      const declares = /function reportedAsSignedOut/.test(source);

      expect(
        declares || /reportedAsSignedOut/.test(source),
        `${path} cannot tell an ended session from a refused value`,
      ).toBe(true);

      /**
       * BOTH answers, from whichever file actually holds the check.
       *
       * Handling only "expired" left the guard dead on the ordinary path: a 401
       * asks rather than declares, and the question takes a round trip these
       * reporters run before. The settings reporter delegates now instead of
       * keeping the copy that drifted, so the states are asserted where they
       * live — demanding the literals in every file would have pushed it back
       * into holding its own.
       */
      if (declares) {
        /**
         * Inside the CHECK's own body.
         *
         * Searching the whole file found the literals wherever they appeared —
         * including in a sibling exported function that has nothing to do with
         * the guard — so `reportedAsSignedOut` could stop handling either state
         * and this still passed.
         */
        const from = source.indexOf("function reportedAsSignedOut");
        const check = source.slice(from, source.indexOf("\n}", from));

        expect(check, `${path} ignores a session it has asked about`).toContain('"checking"');
        expect(check, `${path} ignores a session known to have ended`).toContain('"expired"');
      }

      /**
       * Scoped to the FUNCTION that emits it.
       *
       * Searching the whole file for a guard before the message found the one
       * belonging to the sibling function above — so removing the guard from
       * `reportSettingsReset` left this green, which is the file-scoped
       * weakness this very test exists to close, reproduced inside it.
       */
      // `export async function` and `export const x = () => {}` too: splitting
      // on the bare `export function ` alone would leave either shape invisible.
      const bodies = source.split(/export (?:async )?(?:function |const )/).slice(1);
      expect(bodies.length, `${path} exports nothing to check`).toBeGreaterThan(0);

      let guarded = 0;

      for (const body of bodies) {
        const name = body.slice(0, body.search(/[(:=\s]/)).trim();
        /**
         * EVERY exported reporter, not only the ones whose copy happens to
         * contain the phrase.
         *
         * The first version skipped any function without "on this device only"
         * in it — and `reportSettingsWrite`, the reporter behind all eleven
         * settings pages' Save buttons, says "not saved — the server rejected
         * it" instead. So the guard on the single most-used reporter in the
         * admin was never checked at all.
         */
        if (!/toast\.error\(/.test(body)) continue;
        // The check itself emits the messages it emits ON BEHALF of the
        // callers. It is not a caller.
        if (name === "reportedAsSignedOut") continue;
        guarded += 1;

        const guardAt = body.indexOf("reportedAsSignedOut()");
        expect(
          guardAt,
          `${path} — ${name}() reports a refused write without asking whether the session ended`,
        ).toBeGreaterThan(-1);
        expect(
          guardAt,
          `${path} — ${name}() reaches its misleading message first`,
        ).toBeLessThan(body.indexOf("toast.error("));
        /**
         * And ACTS on the answer.
         *
         * Order alone was satisfied by a bare `reportedAsSignedOut();` on its
         * own line — the guard runs, emits its toast, and the caller then emits
         * the misleading one underneath it. The return value has to change what
         * happens next.
         */
        expect(
          body.slice(guardAt - 20, guardAt + 40),
          `${path} — ${name}() calls the check and speaks anyway`,
        ).toMatch(/(if \(!?reportedAsSignedOut\(\)\)|return reportedAsSignedOut\(\))/);
      }

      expect(guarded, `${path} — no reporter bodies were checked`).toBeGreaterThan(0);
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
    const MODULES = requestMakersUnder(["features", "apps"]).filter(
      (path) => !path.startsWith(STOREFRONT) && !EXEMPT.some((exempt) => path.endsWith(exempt)),
    );

    expect(MODULES.length, "no request-making modules found — has the layout changed?").toBeGreaterThan(
      20,
    );

    for (const path of MODULES) {
      // Comments stripped: several of these EXPLAIN why the ok-check matters,
      // and counting those would let a real site go unnoticed.
      const source = stripComments(read(path));
      /**
       * REQUESTS counted, not ok-checks.
       *
       * The first version matched the literal `res.ok`. Five client modules
       * name their variable `response`, so they were invisible to the fix AND
       * to the guard meant to prove the fix complete — a test for a spelling,
       * not for a property. Widening it to any `x.ok` then over-counted, since
       * `result.ok` on a plain object is not a response either.
       *
       * Every `fetch` produces exactly one response, and every response must be
       * examined once. That is the actual invariant, and it cannot be dodged by
       * renaming anything.
       */
      const requests = (source.match(/(?<![.\w])fetch\(/g) ?? []).length;
      const noted = (source.match(/noteAuthStatus\(/g) ?? []).length;

      // (`requests > 0` is guaranteed by the discovery — a file is only in
      // MODULES because its source matched the same `fetch(` pattern — so
      // asserting it here proved nothing. The count comparison is the check.)
      expect(noted, `${path} makes ${requests} request(s) but reports a 401 ${noted}×`).toBe(
        requests,
      );

      /**
       * And each notice reads the response it belongs to.
       *
       * A count alone says nothing about WHERE. `noteAuthStatus(0)`, or a call
       * reading some other variable, satisfies the arithmetic while never
       * observing a 401 — the shape the count was written to rule out.
       */
      for (const call of source.matchAll(/noteAuthStatus\(([^)]*)\)/g)) {
        expect(
          call[1],
          `${path} calls noteAuthStatus(${call[1]}) — that is not a response status`,
        ).toMatch(/^\w+\.status$/);
      }
    }
  });
});
