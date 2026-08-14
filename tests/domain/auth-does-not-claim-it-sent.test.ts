import { describe, expect, it } from "vitest";

import { AuthRequestError, isDeliveryFailure } from "@/features/auth/lib/auth-api";

/**
 * "We sent you a code" has to mean a code was sent.
 *
 * `/api/auth/forgot-password` answers the same way whether or not the email is
 * registered — deliberately, so it cannot be used to enumerate accounts. Both
 * screens preserved that by swallowing EVERY error, which also swallowed the
 * 429s and the 500s. So a throttled or failed request still showed "Reset code
 * sent", turned the panel green and pushed the customer to an OTP screen backed
 * by no reset row; the resend button said "Code resent" with the outcome
 * discarded outright, to someone already waiting for an email that never came.
 * Their next move is to wait longer.
 *
 * The distinction the screens now make: a refusal the server MEANT, versus a
 * request that did not get through.
 */

describe("telling a refusal from a failure", () => {
  it("treats a throttle as a failure to send", () => {
    expect(isDeliveryFailure(new AuthRequestError("Too many requests", 429))).toBe(true);
  });

  it("treats a server error as a failure to send", () => {
    expect(isDeliveryFailure(new AuthRequestError("Boom", 500))).toBe(true);
    expect(isDeliveryFailure(new AuthRequestError("Bad gateway", 502))).toBe(true);
  });

  it("treats a network throw as a failure to send", () => {
    // `post` only throws AuthRequestError once it has a response. Anything else
    // means the request never completed, so nothing was sent.
    expect(isDeliveryFailure(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("does NOT treat a deliberate refusal as a failure to send", () => {
    // The existence-hiding must survive: a 400 or a 404 here is the endpoint
    // answering the way it is designed to, and the customer must see the same
    // generic message as a registered address does.
    expect(isDeliveryFailure(new AuthRequestError("Invalid email", 400))).toBe(false);
    expect(isDeliveryFailure(new AuthRequestError("Not found", 404))).toBe(false);
  });
});

describe("the error the auth client throws", () => {
  it("carries the status, so the screen can decide", () => {
    const error = new AuthRequestError("Too many requests", 429);

    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(429);
    expect(error.message).toBe("Too many requests");
  });
});
