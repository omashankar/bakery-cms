import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Deleting the session row does not end a session.
 *
 * A refresh token NAMES its session but is not stored inside it, so a chain
 * whose row is gone keeps rotating. Three places got this wrong at once, and
 * they compounded:
 *
 *  - `endSession` deleted the row and left the chain live, under a comment
 *    saying it "kills the whole session as a precaution against stolen-token
 *    replay". On a replayed token the victim's live token was never revoked,
 *    and the cookie clearing landed on the REPLAYER's response, which costs an
 *    attacker nothing.
 *  - The rotation's idle check ran only `if (session)`, so a missing row
 *    skipped it entirely and minted another thirty-day token. A killed session
 *    therefore became HARDER to kill: it could no longer time out, it vanished
 *    from the Security Center's list (which is built from rows), and neither
 *    "Revoke session" nor "Log out everywhere" could reach it, because both
 *    work from rows too.
 *  - `logout` revoked only the token that tab presented. A second tab
 *    refreshing at the same moment had already rotated it, so nothing was
 *    revoked and the browser walked away holding the successor while being
 *    told it was signed out.
 *
 * `security.repository.revokeSession` had it right the whole time — delete the
 * row AND revoke the chain. These are the same pair, in the auth service.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

/** One function's body, so an assertion cannot be satisfied by its neighbour. */
function bodyOf(source: string, declaration: string): string {
  const at = source.indexOf(declaration);
  expect(at, `${declaration} was not found`).toBeGreaterThan(-1);
  const rest = source.slice(at);
  // To the next top-level declaration, or the end.
  const next = rest.search(/\n(?:export )?(?:async )?function /);
  return next > 0 ? rest.slice(0, next) : rest;
}

const service = () => stripComments(read("features/auth/server/auth.service.ts"));

describe("ending a session", () => {
  it("revokes the token chain, not just the row", () => {
    const body = bodyOf(service(), "async function endSession");

    /**
     * Unconditionally, at the statement level. Containment could not see a gate
     * that skips the revoke in exactly the case this test's docblock describes —
     * "delete the row AND revoke the chain" is one act, not two options.
     */
    expect(body, "the chain keeps rotating after the row is gone").toContain(
      "await repo.revokeRefreshTokensBySession(sessionId)",
    );
    // Statement level, not nested in a branch: the revoke and the delete are
    // one act. Built with fromCharCode because every escape written into this
    // file so far has been eaten by the tooling before it landed.
    const NEWLINE = String.fromCharCode(10);
    const INDENT = String.fromCharCode(32);
    /**
     * The INDENT is the check, and `trim()` was throwing it away.
     *
     * `line.trim().startsWith(…)` is true at any nesting depth, so the very
     * thing this assertion is documented to catch — the revoke moved inside a
     * branch while the delete stays unconditional — passed it. The revoke sits
     * one level inside `if (sessionId) {`, so its own statement indent is fixed
     * and anything deeper is a condition that was not there before.
     */
    const revokeLine = body
      .split(NEWLINE)
      .find((line) => line.includes("await repo.revokeRefreshTokensBySession"));

    expect(revokeLine, "the chain revoke is gone from endSession").toBeDefined();

    const depth = (revokeLine ?? "").length - (revokeLine ?? "").trimStart().length;
    const deleteLine =
      body.split(NEWLINE).find((line) => line.includes("await repo.deleteSession")) ?? "";
    const deleteDepth = deleteLine.length - deleteLine.trimStart().length;

    expect(deleteLine, "the row delete is gone from endSession").not.toBe("");
    expect(
      depth,
      `the revoke is nested ${(depth - deleteDepth) / 2} level(s) deeper than the delete — ` +
        "it happens only under some condition the delete does not share",
    ).toBe(deleteDepth);
    expect(INDENT.repeat(depth) + "await", "the revoke is not a statement of its own").toBe(
      (revokeLine ?? "").slice(0, depth + 5),
    );
    expect(body).toContain("deleteSession");
    /**
     * Order matters. Revoking after the delete would still work here, but the
     * pair has to be inseparable — and reading them together is what stops the
     * next person removing one.
     */
    expect(body.indexOf("revokeRefreshTokensBySession")).toBeLessThan(
      body.indexOf("deleteSession"),
    );
  });

  it("is what signing out does, so a racing tab cannot keep the successor", () => {
    const body = bodyOf(service(), "export async function logout");

    expect(body, "sign-out still revokes only the token this tab presented").toContain(
      "await repo.revokeRefreshTokensBySession(claims.sid)",
    );
    // And the delete comes with it: revoking without deleting leaves a row the
    // Security Center still lists as an active device.
    expect(body).toContain("await repo.deleteSession(claims.sid)");
  });

  it("is reachable by the same repository call the security screen uses", () => {
    // Two implementations of "revoke a session's chain" is how the two drifted
    // in the first place. This one is shared.
    const repository = stripComments(read("features/auth/server/auth.repository.ts"));

    expect(repository).toContain("export async function revokeRefreshTokensBySession");

    /**
     * And the security screen ACTUALLY uses it.
     *
     * The comment said “this one is shared” while the security repository kept
     * its own inline updateMany — two implementations of the same act, which is
     * how the auth side went without one at all for so long. Reading only the
     * auth repository could never notice.
     */
    const security = stripComments(read("features/security/server/security.repository.ts"));

    /**
     * Both of the security screen's revokes, each in its own body.
     *
     * File scope could not tell "fixed" from "gone". `not.toContain(
     * "RefreshTokenModel.updateMany")` passes just as green if the file is
     * emptied, renamed, or if only ONE of the two functions was converted —
     * and "log out everywhere" is the one that matters most here, because it
     * is what an owner reaches for after losing a laptop. So each is named,
     * each must reach the shared helper, and neither may hold a chain revoke
     * of its own.
     */
    expect(security, "the security screen no longer imports the shared revoke").toContain(
      'import { revokeRefreshTokensBySession } from "@/features/auth/server/auth.repository"',
    );

    for (const [declaration, argument] of [
      ["export async function revokeSession", "revokeRefreshTokensBySession(sessionId)"],
      ["export async function revokeOtherSessions", "revokeRefreshTokensBySession(ids)"],
    ]) {
      const body = bodyOf(security, declaration);

      expect(body, `${declaration} no longer revokes the chain it just deleted`).toContain(argument);
      expect(body, `${declaration} holds a second implementation of the chain revoke`).not.toContain(
        "RefreshTokenModel.updateMany",
      );
    }
    /**
     * Inside the revoke's OWN body.
     *
     * Both of these read the whole repository file, where `revokedAt: null`
     * already appears twice — in `findActiveRefreshToken` and in
     * `revokeRefreshTokensByUser` — so the filter could be deleted from the
     * function this test is named after and it stayed green. That filter is not
     * cosmetic: without it every sign-out and every session revoke restamps
     * `revokedAt` on tokens revoked long ago, and `ROTATION_RACE_MS` reads
     * exactly those timestamps to decide whether a presented token is a race or
     * a replay. Losing it re-opens the window this file spends fifty lines on.
     */
    const revoke = bodyOf(repository, "export async function revokeRefreshTokensBySession");

    expect(revoke, "the revoke no longer targets the session’s tokens").toContain(
      "sessionId: { $in: ids }",
    );
    expect(revoke, "it would restamp tokens that were already revoked").toContain(
      "revokedAt: null",
    );
  });
});

describe("the rotation's idle check", () => {
  it("refuses a session whose row is gone rather than skipping the check", () => {
    /**
     * `if (session) { …idle check… }` let a missing row through. A row goes
     * missing for ordinary reasons — the TTL index purges it thirty days after
     * login while every rotation slides the token's own expiry forward, and a
     * concurrent double-refresh deletes it out from under a live chain.
     */
    const body = bodyOf(service(), "export async function refresh");
    const lookup = body.indexOf("repo.findSessionById");

    expect(lookup, "the session row is no longer read").toBeGreaterThan(-1);

    const after = body.slice(lookup);
    expect(after, "a missing row still skips the timeout").toMatch(
      /if \(!session\) return endSession\(/,
    );
    // The idle comparison must not be nested back inside an `if (session)`.
    expect(after, "the idle check is conditional again").not.toMatch(
      /if \(session\)[\s\S]{0,120}idleMs/,
    );
  });

  it("does not treat a database error as 'no row'", () => {
    /**
     * The read carried `.catch(() => null)`, which made a failed query
     * indistinguishable from a session that had ended — and with the fix above
     * that would sign an admin out because the database hiccuped. Letting it
     * throw surfaces a 500, which the client reads as "unreachable" and does
     * not act on.
     */
    const body = bodyOf(service(), "export async function refresh");
    const line = body.slice(body.indexOf("repo.findSessionById"));

    // Neither spelling. `.catch(` is one way to swallow it; wrapping the
    // lookup in try/catch is the other, and matching only the first left
    // the identical behaviour a rename away.
    expect(line.slice(0, 160), "a database error is being read as an ended session").not.toContain(
      ".catch(",
    );
    expect(
      bodyOf(service(), "export async function refresh"),
      "the row read is wrapped in a try/catch, which swallows it just the same",
    ).not.toContain("try {");
  });
});

describe("a second tab that lost the rotation race", () => {
  const service = () => stripComments(read("features/auth/server/auth.service.ts"));

  it("is not treated as a stolen token", () => {
    /**
     * Every admin tab beats once on mount and the single-flight guard is per
     * tab, so two tabs opened together both present the same token. One wins
     * and rotates it; the other arrives holding the token just revoked.
     *
     * Killing the chain there revokes the SUCCESSOR the winner handed the
     * browser — its only live credential — so a routine second tab signed the
     * admin out of everything, over their unsaved work. Before the chain was
     * revoked in `endSession` the loser merely deleted the row and the winner
     * carried on; adding the revoke turned a harmless race into a destructive
     * one, which is the shape of a fix disabling something it did not know it
     * depended on.
     */
    const body = bodyOf(service(), "export async function refresh");

    expect(body, "a revoked token cannot be told from one that never existed").toContain(
      "repo.findRefreshToken(",
    );
    expect(body, "there is no window in which a rotation race is still a race").toContain(
      "ROTATION_RACE_MS",
    );

    // And inside that window it must NOT end the session.
    const raceAt = body.indexOf("ROTATION_RACE_MS");
    const branch = body.slice(raceAt, body.indexOf("return endSession", raceAt));

    expect(branch, "the losing tab is still signed out").not.toContain("endSession");
    expect(branch, "the losing tab is not answered at all").toMatch(/return toPublicUser\(/);
  });

  it("still ends the session for a token that was never issued", () => {
    // A replay outside the window, or a token with no row at all, is not a
    // race. The window is a concession to timing, not to unknown tokens.
    const body = bodyOf(service(), "export async function refresh");
    const notActive = body.slice(body.indexOf("if (!stored) {"));

    expect(notActive, "an unknown token no longer ends the session").toMatch(
      /return endSession\(claims\.sid, "Refresh token is no longer valid"\)/,
    );
  });

  it("mints nothing for the loser, so the window costs an attacker nothing", () => {
    /**
     * The browser already holds the successor the winner set. Issuing another
     * pair here would hand a replayer inside the window a working credential,
     * which is the only thing that would make the concession expensive.
     */
    const body = bodyOf(service(), "export async function refresh");
    const raceAt = body.indexOf("ROTATION_RACE_MS");
    const branch = body.slice(raceAt, body.indexOf("return endSession", raceAt));

    expect(branch, "the losing tab is issued a fresh token").not.toContain("signRefreshToken");
    expect(branch, "the losing tab is issued fresh cookies").not.toContain("setAuthCookies");
  });

  it("is told apart from a session somebody deliberately revoked", () => {
    /**
     * `revokedAt` is not a rotation marker.
     *
     * Every revocation stamps it: `revokeRefreshTokensBySession` for "Revoke
     * session" and "Log out everywhere", `revokeRefreshTokensByUser` for a
     * password change or reset. Keyed on the timestamp alone, the window
     * answered a lost laptop's heartbeat with 200 and the full user record for
     * fifteen seconds after its owner revoked it — the client then published
     * "active" and reset its idle clock against a `lastSeenAt` the server had
     * never touched, and the branch skipped `clearAuthCookies`, so the device
     * kept its access-token cookie rather than being cut off then and there.
     *
     * The SESSION ROW is what separates them: the honest loser's row is alive
     * because the winner just rotated and touched that same session, while
     * every deliberate revocation deletes the row before stamping the chain.
     */
    const body = bodyOf(service(), "export async function refresh");
    const raceAt = body.indexOf("ROTATION_RACE_MS");
    const branch = body.slice(raceAt, body.indexOf("return endSession", raceAt));

    expect(branch, "the race window never looks for the session row").toContain(
      "findSessionById(claims.sid)",
    );

    /**
     * And the answer is a CONDITION, not a read whose result is dropped.
     *
     * Fetching the row and returning regardless is the shape this repo keeps
     * producing — the gate that guards the mechanism but not its wiring.
     */
    const success = branch.slice(branch.indexOf("return toPublicUser"));
    const guard = branch.slice(0, branch.indexOf("return toPublicUser"));
    expect(success.length, "the race branch no longer answers success at all").toBeGreaterThan(0);
    expect(guard, "the row is read and then ignored").toMatch(/if \([^)]*session[^)]*\)/);
  });
});

describe("signing out", () => {
  it("does not swallow its own failures", () => {
    /**
     * Both calls carried `.catch(() => undefined)`, so every database failure in
     * the sign-out path was discarded and the controller answered 200 "Signed
     * out". `signOutOfThisDevice` exists to say whether it ACTUALLY happened —
     * that is its whole contract, written because landing on the login form is
     * not proof — and swallowing here took away its ability to find out. On a
     * shared machine the admin walks away believing they are signed out while
     * the chain is still live.
     */
    const body = bodyOf(stripComments(read("features/auth/server/auth.service.ts")), "export async function logout");

    expect(body, "the revoke is fire-and-forget again").not.toMatch(
      /revokeRefreshTokensBySession\([^)]*\)\.catch/,
    );
    expect(body, "the session delete is fire-and-forget again").not.toMatch(
      /deleteSession\([^)]*\)\.catch/,
    );
  });
});
