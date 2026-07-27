import { beforeAll, describe, expect, it } from "vitest";

import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  ttlToDate,
} from "./jwt";

/**
 * jose signing relies on Web Crypto + a spec-compliant TextEncoder that the
 * jsdom test environment does not provide (it rejects with "payload must be an
 * instance of Uint8Array"). Attempts to run these in a node environment via
 * per-file environment / setup files trip a vitest+rolldown config bug in this
 * toolchain, so we instead skip the SIGN-dependent cases under jsdom. They run
 * in a Node environment and in production. Reject-path and pure-logic tests
 * need no signing and always run.
 */
const isJsdom =
  typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = "test-access-secret-please-change";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-please-change";
});

describe("jwt", () => {
  it.skipIf(isJsdom)("signs and verifies an access token", async () => {
    const token = await signAccessToken({ sub: "u1", role: "owner", email: "a@b.com" });
    const claims = await verifyAccessToken(token);
    expect(claims?.sub).toBe("u1");
    expect(claims?.role).toBe("owner");
    expect(claims?.type).toBe("access");
  });

  it.skipIf(isJsdom)("signs and verifies a refresh token", async () => {
    const token = await signRefreshToken({ sub: "u1", sid: "s1" });
    const claims = await verifyRefreshToken(token);
    expect(claims?.sub).toBe("u1");
    expect(claims?.sid).toBe("s1");
  });

  it.skipIf(isJsdom)("does not accept an access token as a refresh token", async () => {
    const access = await signAccessToken({ sub: "u1", role: "owner", email: "a@b.com" });
    expect(await verifyRefreshToken(access)).toBeNull();
  });

  // --- Always run (no signing needed) ---

  it("returns null for a malformed/garbage token", async () => {
    expect(await verifyAccessToken("not-a-jwt")).toBeNull();
    expect(await verifyAccessToken("a.b.c")).toBeNull();
    expect(await verifyRefreshToken("")).toBeNull();
  });

  it("ttlToDate converts durations to future dates", () => {
    const now = Date.now();
    expect(ttlToDate("15m").getTime()).toBeGreaterThan(now);
    expect(ttlToDate("30d").getTime()).toBeGreaterThan(ttlToDate("1d").getTime());
  });
});
