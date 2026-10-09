import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A STRANGER COULD KEEP THE OWNER OUT OF THEIR OWN ADMIN.
 *
 * The login throttle counts against the account email — rightly, because an
 * address the caller writes can be rotated for free. But the owner's email is
 * usually the shop's public contact address, so six wrong passwords a minute
 * from anyone kept every honest attempt answering 429, indefinitely.
 *
 * A browser that has signed in before now carries a device cookie and is
 * counted on its own. Driven through the real controller and the real
 * limiter; only the cookie jar, the policy and the password check are faked.
 */

const state = vi.hoisted(() => ({
  jar: new Map<string, string>(),
  goodPassword: "correct horse",
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (state.jar.has(name) ? { value: state.jar.get(name) } : undefined),
    set: (name: string, value: string) => void state.jar.set(name, value),
    delete: (name: string) => void state.jar.delete(name),
  }),
}));
vi.mock("@/features/settings/server/security-policy.server", () => ({
  getSecurityPolicy: async () => ({}),
  loginAttemptLimit: () => 5,
}));
vi.mock("@/lib/server/audit/audit-log", () => ({
  requestContext: () => ({ ip: "", userAgent: "test" }),
  writeAuditLog: async () => undefined,
}));
vi.mock("@/features/auth/server/auth.service", () => ({
  login: async (input: { password: string }) => {
    if (input.password !== state.goodPassword) {
      const { AuthError } = await import("@/lib/server/http/errors");
      throw new AuthError("Invalid email or password");
    }
    return { email: "owner@shop.in" };
  },
}));

process.env.JWT_ACCESS_SECRET ||= "test-secret-for-device-cookie";

const { loginController } = await import("@/features/auth/server/auth.controller");
const { DEVICE_COOKIE } = await import("@/lib/server/auth/device-cookie");

function attempt(password: string, email = "owner@shop.in") {
  return loginController(
    new Request("http://shop.test/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
  );
}

beforeEach(() => {
  state.jar.clear();
});

describe("the login throttle", () => {
  it("does not lock the owner out of a browser they have signed in from", async () => {
    // Monday: the owner signs in on the shop laptop. Their browser is remembered.
    expect((await attempt("correct horse")).status).toBe(200);
    const ownersDevice = state.jar.get(DEVICE_COOKIE);
    expect(ownersDevice).toBeTruthy();

    // A stranger, with no cookie, hammers the account.
    state.jar.clear();
    for (let i = 0; i < 10; i += 1) await attempt("guess");
    expect((await attempt("correct horse")).status).toBe(429);

    // The owner, on the laptop, is unaffected.
    state.jar.clear();
    state.jar.set(DEVICE_COOKIE, ownersDevice!);
    expect((await attempt("correct horse")).status).toBe(200);
  });

  it("does not accept another account's device cookie", async () => {
    await attempt("correct horse", "staff@shop.in");
    const staffDevice = state.jar.get(DEVICE_COOKIE)!;

    state.jar.clear();
    state.jar.set(DEVICE_COOKIE, staffDevice);
    for (let i = 0; i < 10; i += 1) await attempt("guess", "victim@shop.in");
    // Counted against the victim's ACCOUNT, so it is throttled like a stranger.
    expect((await attempt("guess", "victim@shop.in")).status).toBe(429);
  });
});
