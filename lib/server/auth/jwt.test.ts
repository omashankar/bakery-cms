// @vitest-environment node
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  ttlToDate,
  signCustomerToken,
  verifyCustomerToken,
} from "./jwt";

/**
 * This file runs in NODE, not the suite's jsdom — see the pragma above.
 *
 * `jose` signs with Web Crypto and a spec-compliant TextEncoder, which jsdom
 * does not provide: it rejects with "payload must be an instance of Uint8Array".
 * The three signing tests were therefore guarded by `it.skipIf(isJsdom)` — and
 * the suite's environment IS jsdom, globally, so that condition was true every
 * time. All three never ran. One of them is the check that an ACCESS token is
 * refused where a REFRESH token is required, which is the whole reason the two
 * are signed with different secrets.
 *
 * The comment they carried said a per-file environment "trips a vitest+rolldown
 * config bug in this toolchain". Whatever that was, it is gone on vitest 4.1 —
 * the pragma works, and the tests run.
 */

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = "test-access-secret-please-change";
  process.env.JWT_REFRESH_SECRET = "test-refresh-secret-please-change";
});

describe("jwt", () => {
  it("signs and verifies an access token", async () => {
    const token = await signAccessToken({ sub: "u1", role: "owner", email: "a@b.com" });
    const claims = await verifyAccessToken(token);
    expect(claims?.sub).toBe("u1");
    expect(claims?.role).toBe("owner");
    expect(claims?.type).toBe("access");
  });

  it("signs and verifies a refresh token", async () => {
    const token = await signRefreshToken({ sub: "u1", sid: "s1" });
    const claims = await verifyRefreshToken(token);
    expect(claims?.sub).toBe("u1");
    expect(claims?.sid).toBe("s1");
  });

  it("does not accept an access token as a refresh token", async () => {
    const access = await signAccessToken({ sub: "u1", role: "owner", email: "a@b.com" });
    expect(await verifyRefreshToken(access)).toBeNull();
  });

  /**
   * The `type` claim, on its own, with the signature taken out of the argument.
   *
   * The test above passes on the SIGNATURE — access and refresh are signed with
   * different secrets, so the token is rejected before `payload.type` is ever
   * looked at. Deleting the type check entirely leaves it green, which is the
   * shape of guard this repo keeps producing.
   *
   * These make the type check load-bearing by giving both sides the same
   * secret, which is not a contrivance:
   *
   *  - `customerSecret()` falls back to `JWT_ACCESS_SECRET`, and
   *    `JWT_CUSTOMER_SECRET` is optional. A shop that has not set it — this one
   *    has not — signs a STOREFRONT customer's token and an ADMIN's access
   *    token with the same key today. The type claim is the only thing between
   *    a customer and the admin API.
   *  - An operator pasting one value into both `JWT_ACCESS_SECRET` and
   *    `JWT_REFRESH_SECRET` is an ordinary mistake, and it is exactly the case
   *    where the signature stops separating those two.
   */
  describe("when the two secrets are the same key", () => {
    const ACCESS = process.env.JWT_ACCESS_SECRET;
    const REFRESH = process.env.JWT_REFRESH_SECRET;
    const CUSTOMER = process.env.JWT_CUSTOMER_SECRET;

    beforeEach(() => {
      process.env.JWT_ACCESS_SECRET = "one-secret-in-every-slot";
      process.env.JWT_REFRESH_SECRET = "one-secret-in-every-slot";
      delete process.env.JWT_CUSTOMER_SECRET;
    });

    afterEach(() => {
      process.env.JWT_ACCESS_SECRET = ACCESS;
      process.env.JWT_REFRESH_SECRET = REFRESH;
      if (CUSTOMER === undefined) delete process.env.JWT_CUSTOMER_SECRET;
      else process.env.JWT_CUSTOMER_SECRET = CUSTOMER;
    });

    it("still refuses an access token where a refresh token is required", async () => {
      const access = await signAccessToken({ sub: "u1", role: "owner", email: "a@b.com" });
      expect(await verifyRefreshToken(access)).toBeNull();
    });

    it("still refuses a refresh token where an access token is required", async () => {
      const refresh = await signRefreshToken({ sub: "u1", sid: "s1" });
      expect(await verifyAccessToken(refresh)).toBeNull();
    });

    it("does not let a storefront customer's token into the admin", async () => {
      // The one that is live: no JWT_CUSTOMER_SECRET means this token is signed
      // with the admin's own access key.
      const customer = await signCustomerToken({ sub: "c1", email: "shopper@example.com" });

      expect(
        await verifyAccessToken(customer),
        "a customer's session verified as an admin's",
      ).toBeNull();
    });

    it("does not let an admin's token be used as a customer's", async () => {
      const access = await signAccessToken({ sub: "u1", role: "owner", email: "a@b.com" });
      expect(await verifyCustomerToken(access)).toBeNull();
    });
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
