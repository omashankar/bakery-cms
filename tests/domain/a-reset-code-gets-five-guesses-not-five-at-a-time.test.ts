import { describe, expect, it, vi } from "vitest";

/**
 * FIVE ATTEMPTS PER RESET CODE — UNLESS YOU SENT THEM ALL AT ONCE.
 *
 * `verifyOtp` and `resetPassword` read `attempts`, compared it with the limit,
 * and only incremented after a wrong guess. Requests fired in parallel all read
 * the same count, so a code meant to allow five guesses allowed hundreds.
 *
 * The attempt is now claimed atomically BEFORE the comparison. The fake
 * repository below models the conditional update exactly as Mongo applies it:
 * one at a time, against the current count.
 */

const state = vi.hoisted(() => ({ attempts: 0, compared: 0 }));

vi.mock("@/features/auth/server/auth.repository", () => ({
  findActiveReset: async () => {
    // Every parallel request sees the same document, as they would.
    return {
      _id: "reset-1",
      attempts: state.attempts,
      get otpHash() {
        state.compared += 1;
        return "not-the-hash-of-any-guess";
      },
    };
  },
  claimResetAttempt: async (_id: string, max: number) => {
    if (state.attempts >= max) return false;
    state.attempts += 1;
    return true;
  },
}));
vi.mock("@/lib/server/audit/audit-log", () => ({ writeAuditLog: async () => undefined }));

const { verifyOtp } = await import("@/features/auth/server/auth.service");

describe("a reset code", () => {
  it("gets five guesses even when fifty arrive at once", async () => {
    const guesses = Array.from({ length: 50 }, (_, i) =>
      verifyOtp({ email: "owner@shop.in", otp: String(100000 + i) }).catch((e: Error) => e.message),
    );
    const results = await Promise.all(guesses);

    expect(state.compared).toBe(5);
    expect(results.filter((r) => r === "Incorrect code")).toHaveLength(5);
    expect(results.filter((r) => /Too many attempts/.test(String(r)))).toHaveLength(45);
  });
});
