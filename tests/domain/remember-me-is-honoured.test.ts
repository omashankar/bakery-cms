// @vitest-environment node
//
// jose signs with WebCrypto, and jsdom hands it a Uint8Array from a different
// realm — "payload must be an instance of Uint8Array". These tests mint and
// read real tokens, and nothing here needs a DOM.
/**
 * "Keep me signed in" was collected, validated — and dropped.
 *
 * `login` parsed `rememberMe` off the request and never passed it on;
 * `issueTokens` did not take it, and `setAuthCookies` wrote the refresh cookie
 * with a 30-day `expires` every time. So unticking the box on a shared or
 * public machine changed nothing at all: closing the browser left a working
 * admin session for whoever opened it next.
 *
 * A cookie with no `expires` is a SESSION cookie — the browser discards it when
 * it closes. The server-side session row is untouched either way; this governs
 * how long this BROWSER keeps presenting it.
 *
 * And then the guard written to hold that fix could not fail. Everything below
 * the cookie tests read auth.service.ts off disk and matched regexes against
 * the WHOLE of it, so restoring the original bug — `const remembered =
 * isRemembered(claims)` replaced by `const remembered = false`, with the call
 * left behind in a trailing comment — kept this file at 9/9 and the suite at
 * 2118. A regex over raw text cannot tell code from the comment beside it, and
 * it cannot tell "the flag is mentioned" from "the flag is obeyed".
 *
 * So the service is DRIVEN here. The repository, the audit log, the mailer and
 * the policy read are mocked, because none of them decide this; `jwt.ts` and
 * `cookies.ts` are deliberately REAL, because they are the mechanism under
 * test. The assertions read the `expires` the cookie was actually written
 * with, and the `remember` claim inside the token that was actually minted.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// jwt.ts reads these inside `secretFor()` at sign time, so a hoisted
// assignment is early enough even for a static import of the service. Vitest
// loads no .env.local and runs no setup file — unset, the first sign throws.
vi.hoisted(() => {
  process.env.JWT_ACCESS_SECRET ||= "test-access-secret";
  process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret";
});

const set = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ set, get: () => undefined, delete: () => {} }),
}));

/**
 * Everything the two flows touch that is not the decision.
 *
 * Every member of the real repository opens a Mongo connection, so unmocked,
 * `login` never reaches `issueTokens` at all. The fixtures below are chosen to
 * walk both flows all the way to the rotation: a falsy `findActiveRefreshToken`
 * diverts into the replay branch, a falsy `findSessionById` ends the session,
 * and a stale `lastSeenAt` times it out — and none of those three write a
 * cookie, so a wrong fixture here reads as "no refresh cookie was written"
 * rather than as a remember-me failure.
 */
const repo = vi.hoisted(() => ({
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  touchLastLogin: vi.fn(),
  createSession: vi.fn(),
  createRefreshToken: vi.fn(),
  findSessionById: vi.fn(),
  findActiveRefreshToken: vi.fn(),
  findRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
  revokeRefreshTokensBySession: vi.fn(),
  deleteSession: vi.fn(),
  touchSession: vi.fn(),
}));
// `auth.service` imports it as `./auth.repository`; both paths resolve to the
// same module, so mocking the alias replaces it.
vi.mock("@/features/auth/server/auth.repository", () => repo);

vi.mock("@/lib/server/auth/password", () => ({
  verifyPassword: vi.fn(async () => true),
  hashPassword: vi.fn(async () => "hashed"),
}));
vi.mock("@/lib/server/audit/audit-log", () => ({ writeAuditLog: vi.fn(async () => undefined) }));
vi.mock("@/features/communications/server/email.service", () => ({
  sendTemplatedEmail: vi.fn(async () => ({ sent: true })),
}));
vi.mock("@/features/settings/server/security-policy.server", () => ({
  getSecurityPolicy: vi.fn(async () => ({ sessionTimeoutMinutes: 60 })),
  accessTokenTtl: vi.fn(() => "15m"),
  // Generously wide, so the idle check is never what these tests measure.
  sessionTimeoutMs: vi.fn(() => 60 * 60_000),
}));

import { REFRESH_COOKIE } from "@/lib/server/auth/cookies";
import { REFRESH_TTL, signRefreshToken, verifyRefreshToken } from "@/lib/server/auth/jwt";
import { login, refresh } from "@/features/auth/server/auth.service";

const ctx = { ip: "1.2.3.4", userAgent: "probe" };

/** `toPublicUser` calls `doc.toJSON()`, so a plain object crashes on the way out. */
const userDoc = () => ({
  _id: "user-1",
  email: "asha@example.com",
  role: "owner",
  status: "active",
  passwordHash: "never read — verifyPassword is mocked",
  toJSON: () => ({
    id: "user-1",
    name: "Asha",
    email: "asha@example.com",
    role: "owner",
    status: "active",
  }),
});

beforeEach(() => {
  // `restoreMocks` only restores spies, and `clearAllMocks` clears call history
  // but not implementations — so the defaults are re-installed every test.
  vi.clearAllMocks();
  repo.findUserByEmail.mockResolvedValue(userDoc());
  repo.findUserById.mockResolvedValue(userDoc());
  repo.touchLastLogin.mockResolvedValue(undefined);
  repo.createSession.mockResolvedValue({ _id: "session-1" });
  repo.createRefreshToken.mockResolvedValue({ _id: "token-row-2" });
  repo.findActiveRefreshToken.mockResolvedValue({ _id: "token-row-1" });
  repo.findSessionById.mockResolvedValue({ _id: "session-1", lastSeenAt: new Date() });
  repo.revokeRefreshToken.mockResolvedValue(undefined);
  // `.catch()` is called on this one — a bare vi.fn() returns undefined and the
  // rotation dies before it writes anything.
  repo.touchSession.mockResolvedValue(undefined);
});

/** The options the refresh cookie was written with. */
async function refreshCookieOptions(rememberMe?: boolean) {
  const { setAuthCookies } = await import("@/lib/server/auth/cookies");
  if (rememberMe === undefined) await setAuthCookies("access", "refresh");
  else await setAuthCookies("access", "refresh", undefined, rememberMe);

  const call = set.mock.calls.find(([name]) => String(name).includes("refresh"));
  expect(call, "no refresh cookie was written").toBeTruthy();
  return call![2] as { expires?: Date };
}

/**
 * What the service just handed the browser: the cookie's options, and the
 * claims of the token inside that cookie.
 *
 * Both halves, every time, because they are independently revertible — and
 * that is how the original bug survived its own test. Drop `remember` from the
 * minted token and every cookie assertion still passes, because the damage
 * lands on the NEXT rotation; drop the fourth argument to `setAuthCookies` and
 * every claim assertion still passes.
 *
 * By name, never by index: the access cookie is written first and ALWAYS
 * carries an `expires`, so `calls[0]` would make a session-only cookie look
 * persistent.
 */
async function refreshCookieWritten() {
  const call = set.mock.calls.find(([name]) => name === REFRESH_COOKIE);
  expect(call, "no refresh cookie was written").toBeTruthy();
  const [, value, options] = call as unknown as [string, string, { expires?: Date }];
  const claims = await verifyRefreshToken(value);
  expect(claims, "the refresh cookie does not hold a readable refresh token").toBeTruthy();
  return { options, claims: claims! };
}

/** Sign in for real, and read back what the browser was given. */
async function signIn(rememberMe: boolean) {
  await login({ email: "asha@example.com", password: "correct-horse-1", rememberMe }, ctx);
  return refreshCookieWritten();
}

/** Rotate a token we minted ourselves — the incoming claims are the only variable. */
async function rotate(incoming: Parameters<typeof signRefreshToken>[0]) {
  await refresh(await signRefreshToken(incoming), ctx);
  return refreshCookieWritten();
}

/**
 * A kept session is kept for the REFRESH token's lifetime, not merely "later".
 *
 * Every persistent-cookie assertion here used to be `toBeInstanceOf(Date)` plus
 * `getTime() > Date.now()`, which is satisfied by any positive TTL at all. At
 * both call sites `accessTtl` is the argument sitting immediately beside
 * `rememberMe`, and `cookies.ts` writes `expires: ttlToDate(accessTtl)` for the
 * access cookie one line above the refresh cookie — so swapping in the wrong one
 * turns "keep me signed in" into "keep me signed in for fifteen minutes" while
 * every test above stays green, and the failure message still reads "a remembered
 * session was not persisted". The same hole swallows a malformed `JWT_REFRESH_TTL`:
 * `ttlToDate` falls back to 15 minutes on anything it cannot parse.
 *
 * A floor rather than an equality: the point is that the cookie outlives the
 * browser by a margin no access-token lifetime could reach, and pinning it to the
 * exact configured value would just re-derive the number under test.
 */
const KEPT_FLOOR_MS = 7 * 86_400_000;

function expectKeptForRefreshTtl(expires: Date | undefined, symptom: string) {
  expect(expires, symptom).toBeInstanceOf(Date);
  expect(
    expires!.getTime() - Date.now(),
    `${symptom} — it carries a short lifetime, not ${REFRESH_TTL}`,
  ).toBeGreaterThan(KEPT_FLOOR_MS);
}

/**
 * The cookie must not outlive the token inside it, nor die before it.
 *
 * `exp` is stamped by jose at sign time and is real on every token here, but it
 * is not on `RefreshClaims` — the interface describes what this codebase puts in
 * the payload, not what JWT adds around it.
 */
function expectCookieAgreesWithToken(expires: Date | undefined, claims: object) {
  const { exp } = claims as { exp?: number };
  expect(exp, "the refresh token carries no expiry").toBeTruthy();
  expect(
    Math.abs(expires!.getTime() - exp! * 1000),
    "the refresh cookie and the token inside it expire at different times",
  ).toBeLessThan(5_000);
}
describe("the refresh cookie", () => {
  it("outlives the browser when the admin asked it to", async () => {
    const options = await refreshCookieOptions(true);

    expectKeptForRefreshTtl(options.expires, "a remembered session was not persisted");
  });

  it("is discarded with the browser when they did not", async () => {
    const options = await refreshCookieOptions(false);

    expect(
      options.expires,
      "unticking 'Keep me signed in' still left a cookie that survives the browser",
    ).toBeUndefined();
  });

  it("defaults to persisting, so a token refresh cannot shorten a kept session", async () => {
    // `refreshTokens` re-issues cookies without expressing a preference. If the
    // default were session-only, every refresh would silently downgrade a
    // session the admin had chosen to keep.
    const options = await refreshCookieOptions();

    expectKeptForRefreshTtl(options.expires, "the default stopped persisting the session");
  });
});

describe("signing in", () => {
  /**
   * The headline defect: the checkbox reaching the cookie.
   *
   * Three assertions used to stand here, all of them regexes over the raw text
   * of auth.service.ts — `/issueTokens\([^;]*input\.rememberMe/`,
   * `/setAuthCookies\(accessToken, refreshToken, accessTtl, rememberMe\)/` and
   * `/remember: rememberMe/`. They tested that those WORDS were still in the
   * file, which is something a comment satisfies and a gutted body does not
   * disturb. These two call `login` and read the cookie that came out of it.
   */
  it("gives a browser-only session a cookie that dies with the browser", async () => {
    const { options, claims } = await signIn(false);

    // The whole point of the box: nothing left behind on a shared machine.
    expect(
      options.expires,
      "unticking 'Keep me signed in' still left a cookie that survives the browser",
    ).toBeUndefined();
    // And sealed into the token, or the first background refresh re-defaults it.
    expect(claims.remember, "the choice does not survive one background refresh").toBe(false);
  });

  it("gives a kept session a cookie that outlives it", async () => {
    const { options, claims } = await signIn(true);

    expectKeptForRefreshTtl(options.expires, "a remembered session was not persisted");
    expectCookieAgreesWithToken(options.expires, claims);
    expect(claims.remember, "the choice does not survive one background refresh").toBe(true);
  });
});

describe("a token rotation", () => {
  /**
   * The choice has to survive the refresh, and it nearly did not.
   *
   * `refreshTokens` re-issues both cookies. It called `setAuthCookies` without
   * a preference, so the `rememberMe = true` default stamped a 30-day expires
   * on a cookie the login had deliberately written as session-only — one
   * background refresh silently undoing an admin's choice on a shared machine.
   *
   * The server cannot read back the expiry of the cookie it is replacing, so
   * the flag travels inside the refresh token itself. That is the line the
   * regex guard was watching and could not actually see: `isRemembered(claims)`
   * swapped for `false`, with the call left in a trailing comment, passed it
   * while the behaviour was gone. These hand `refresh` a token we minted, and
   * read the token it minted back.
   */
  it("leaves a browser-only session browser-only", async () => {
    const { options, claims } = await rotate({ sub: "user-1", sid: "session-1", remember: false });

    // The exact regression that was proven uncovered: the admin unticked the
    // box, and a heartbeat thirty seconds later handed the browser a 30-day
    // cookie anyway.
    expect(
      options.expires,
      "a background refresh re-stamped 30 days on a session the admin asked not to keep",
    ).toBeUndefined();
    // And the successor carries the choice too, or the NEXT rotation loses it.
    expect(claims.remember, "the choice is dropped one rotation later instead").toBe(false);
  });

  it("leaves a kept session kept", async () => {
    const { options, claims } = await rotate({ sub: "user-1", sid: "session-1", remember: true });

    expectKeptForRefreshTtl(
      options.expires,
      "a remembered session was downgraded to browser-only by its own refresh",
    );
    expectCookieAgreesWithToken(options.expires, claims);
    expect(claims.remember).toBe(true);
  });

  it("treats a token minted before the claim existed as remembered", async () => {
    /**
     * Those sessions were 30-day by definition, so `undefined` must not
     * silently downgrade them to session-only on the next refresh — every
     * admin holding one would be signed out mid-shift with nothing anywhere
     * saying why.
     *
     * This asserted against a lambda declared in the test body, and then
     * against `isRemembered` in isolation. Neither could tell whether the
     * ROTATION asks it: `const remembered = false` left both green. The rule is
     * exercised through the code path that depends on it now.
     */
    const { options, claims } = await rotate({ sub: "user-1", sid: "session-1" });

    expectKeptForRefreshTtl(options.expires, "a legacy session was downgraded to browser-only");
    // Exactly `true`, not merely "not false" — `isRemembered` normalises the
    // missing claim on the way out, so the successor stops being a legacy token.
    expect(claims.remember, "the successor is legacy too, and stays undecided forever").toBe(true);
  });

  it("carries a login's choice through the rotation that follows it", async () => {
    /**
     * End to end, with nothing hand-minted in between.
     *
     * The two halves live in two functions and were fixed in two places, and
     * each one's guard passed while the other was broken. So this walks the
     * path the admin walks — untick the box, sign in, let the heartbeat rotate
     * — and checks the browser is still holding a cookie that dies with it.
     */
    const signedIn = await signIn(false);
    const issued = set.mock.calls.find(([name]) => name === REFRESH_COOKIE)![1] as string;
    set.mockClear();

    await refresh(issued, ctx);
    const rotated = await refreshCookieWritten();

    expect(signedIn.options.expires).toBeUndefined();
    expect(
      rotated.options.expires,
      "the session the admin refused to keep outlives the browser after one heartbeat",
    ).toBeUndefined();
    expect(rotated.claims.remember).toBe(false);
  });
});
