import { beforeEach, describe, expect, it, vi } from "vitest";

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
 */

const set = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ set, get: () => undefined, delete: () => {} }),
}));

beforeEach(() => {
  set.mockClear();
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

describe("the refresh cookie", () => {
  it("outlives the browser when the admin asked it to", async () => {
    const options = await refreshCookieOptions(true);

    expect(options.expires, "a remembered session was not persisted").toBeInstanceOf(Date);
    expect(options.expires!.getTime()).toBeGreaterThan(Date.now());
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

    expect(options.expires).toBeInstanceOf(Date);
  });
});

describe("the login itself", () => {
  /**
   * The headline defect, and until now the only part with no assertion.
   *
   * Everything below tested the ROTATION. Deleting the fourth argument from
   * `setAuthCookies` in `issueTokens` — the original bug, verbatim — left every
   * test in this file green, and the checkbox inert again. Dropping
   * `remember: rememberMe` from the token was green too: the claim is optional,
   * so TypeScript accepts it and the first rotation then reads `undefined` as
   * remembered and re-stamps 30 days on a session the admin asked not to keep.
   */
  const service = () =>
    import("node:fs").then(({ readFileSync }) =>
      readFileSync("features/auth/server/auth.service.ts", "utf8"),
    );

  it("hands the admin's choice to the token issuer", async () => {
    expect(await service(), "login collects rememberMe and drops it again").toMatch(
      // `[^;]` rather than `.` with the /s flag: the tsconfig target predates it.
      /issueTokens\([^;]*input\.rememberMe/,
    );
  });

  it("writes the refresh cookie with it, not with the default", async () => {
    expect(
      await service(),
      "the cookie is written with the default, so unticking the box changes nothing",
    ).toMatch(/setAuthCookies\(accessToken, refreshToken, accessTtl, rememberMe\)/);
  });

  it("seals it into the token so the first rotation cannot undo it", async () => {
    expect(await service(), "the choice does not survive one background refresh").toMatch(
      /remember: rememberMe/,
    );
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
   * the flag travels inside the refresh token itself.
   */
  it("carries the preference in the refresh token's claims", async () => {
    const source = await import("node:fs").then(({ readFileSync }) =>
      readFileSync("lib/server/auth/jwt.ts", "utf8"),
    );

    expect(source, "RefreshClaims cannot express the preference").toMatch(/remember\?: boolean;/);
  });

  it("re-issues from the token's own claim rather than the default", async () => {
    const source = await import("node:fs").then(({ readFileSync }) =>
      readFileSync("features/auth/server/auth.service.ts", "utf8"),
    );

    // Read from the incoming token…
    expect(source).toMatch(/isRemembered\(claims\)/);
    // …and handed to BOTH the new token and the cookie that carries it.
    expect(source).toMatch(/remember: remembered/);
    expect(source).toMatch(/setAuthCookies\(accessToken, newRefresh, accessTtl, remembered\)/);
  });

  it("treats a token minted before the claim existed as remembered", async () => {
    /**
     * Those sessions were 30-day by definition, so `undefined` must not
     * silently downgrade them to session-only on the next refresh.
     *
     * This asserted against a lambda declared in the test body — it imported
     * nothing and read no source, so `claims.remember === true` (which signs
     * every legacy session out on its next background refresh) passed it. The
     * decision is one exported function now, and this exercises that function.
     */
    const { isRemembered } = await import("@/lib/server/auth/jwt");

    expect(isRemembered({}), "a legacy session was downgraded to browser-only").toBe(true);
    expect(isRemembered({ remember: true })).toBe(true);
    expect(isRemembered({ remember: false })).toBe(false);
  });
});
