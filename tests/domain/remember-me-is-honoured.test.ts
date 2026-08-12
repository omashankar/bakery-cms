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
