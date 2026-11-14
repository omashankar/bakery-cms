// @vitest-environment node
//
// jose signs with WebCrypto, and jsdom hands it a Uint8Array from a different
// realm. These tests mint and read real tokens, and nothing here needs a DOM.
/**
 * A refresh whose ANSWER never reached the browser must not sign the admin out.
 *
 * Every admin page beats once on mount, and the server ROTATES on every beat.
 * Reload, close the tab or lose the connection while that beat is in flight,
 * and the server has rotated while the browser still holds the old token. The
 * rotation-race window then answered "success" and minted nothing — on the
 * theory that the browser already held the successor — so the browser kept
 * the dead token, and its next beat after fifteen seconds was read as a
 * replay: 401, cookies cleared, the admin thrown out over their work.
 * Reproduced on a production build on 2026-11-14 by rotating from a second
 * client while the browser held on to the token.
 *
 * So inside the window the old token is exchanged again for a fresh pair (a
 * reuse interval), with every check a rotation makes. These DRIVE `refresh`:
 * the repository is mocked, `jwt.ts` and `cookies.ts` are real, and the
 * assertions read the token that was actually written to the cookie.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.JWT_ACCESS_SECRET ||= "test-access-secret";
  process.env.JWT_REFRESH_SECRET ||= "test-refresh-secret";
});

const set = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ set, get: () => undefined, delete: () => {} }),
}));

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
  revokeRefreshTokensByUser: vi.fn(),
  deleteSession: vi.fn(),
  deleteSessionsByUser: vi.fn(),
  updateUserPassword: vi.fn(),
  touchSession: vi.fn(),
}));
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
  sessionTimeoutMs: vi.fn(() => 60 * 60_000),
}));

import { REFRESH_COOKIE } from "@/lib/server/auth/cookies";
import { signRefreshToken, verifyRefreshToken } from "@/lib/server/auth/jwt";
import { changePassword, logout, refresh } from "@/features/auth/server/auth.service";

const ctx = { ip: "1.2.3.4", userAgent: "probe" };

const userDoc = (status = "active") => ({
  _id: "user-1",
  email: "asha@example.com",
  role: "owner",
  status,
  passwordHash: "never read — verifyPassword is mocked",
  toJSON: () => ({ id: "user-1", name: "Asha", email: "asha@example.com", role: "owner", status }),
});

const SECONDS = 1000;

/** The browser's token, rotated `ago` ms ago by an answer it never received. */
function rotatedAgo(ago: number | null) {
  repo.findActiveRefreshToken.mockResolvedValue(null);
  repo.findRefreshToken.mockResolvedValue(
    ago === null ? null : { _id: "token-row-1", revokedAt: new Date(Date.now() - ago) },
  );
}

const presented = () => signRefreshToken({ sub: "user-1", sid: "session-1", remember: true });

/** The refresh token the server just wrote to the browser, if any. */
async function writtenRefreshToken() {
  const call = set.mock.calls.find(([name, value]) => name === REFRESH_COOKIE && value);
  return call ? verifyRefreshToken(String(call[1])) : null;
}

beforeEach(() => {
  vi.clearAllMocks();
  repo.findUserById.mockResolvedValue(userDoc());
  repo.createRefreshToken.mockResolvedValue({ _id: "token-row-2" });
  repo.findActiveRefreshToken.mockResolvedValue({ _id: "token-row-1" });
  repo.findSessionById.mockResolvedValue({ _id: "session-1", lastSeenAt: new Date() });
  for (const fn of [
    repo.revokeRefreshToken,
    repo.revokeRefreshTokensBySession,
    repo.revokeRefreshTokensByUser,
    repo.deleteSession,
    repo.deleteSessionsByUser,
    repo.updateUserPassword,
    repo.touchSession,
  ]) fn.mockResolvedValue(undefined);
});

describe("a token whose rotation answer was lost", () => {
  it("is exchanged again for a working pair inside the window", async () => {
    rotatedAgo(3 * SECONDS);

    await expect(refresh(await presented(), ctx)).resolves.toMatchObject({ id: "user-1" });

    const token = await writtenRefreshToken();
    expect(token, "the browser was answered with no new token — it keeps the dead one").toBeTruthy();
    expect(token!.sid, "the new token belongs to a different session").toBe("session-1");
    expect(repo.createRefreshToken, "the new token was never stored").toHaveBeenCalledTimes(1);
    expect(repo.touchSession, "the idle clock was not moved").toHaveBeenCalledWith("session-1");
  });

  it("does not re-stamp the raced token, so its window cannot slide forward", async () => {
    rotatedAgo(3 * SECONDS);
    await refresh(await presented(), ctx);
    expect(repo.revokeRefreshToken).not.toHaveBeenCalled();
  });

  it("is still a replay once the window has passed", async () => {
    rotatedAgo(20 * SECONDS);

    await expect(refresh(await presented(), ctx)).rejects.toThrow("Refresh token is no longer valid");
    expect(repo.createRefreshToken).not.toHaveBeenCalled();
    expect(await writtenRefreshToken()).toBeNull();
    expect(repo.revokeRefreshTokensBySession).toHaveBeenCalledWith("session-1");
  });

  it("is a replay when it was never issued at all", async () => {
    rotatedAgo(null);

    await expect(refresh(await presented(), ctx)).rejects.toThrow();
    expect(repo.createRefreshToken).not.toHaveBeenCalled();
  });

  it("gets nothing when the session was deliberately revoked inside the window", async () => {
    // Revoke session / log out everywhere / password change all delete the ROW.
    rotatedAgo(3 * SECONDS);
    repo.findSessionById.mockResolvedValue(null);

    await expect(refresh(await presented(), ctx)).rejects.toThrow("Session no longer exists");
    expect(repo.createRefreshToken).not.toHaveBeenCalled();
    expect(await writtenRefreshToken()).toBeNull();
  });

  it("gets nothing for an account that was disabled", async () => {
    rotatedAgo(3 * SECONDS);
    repo.findUserById.mockResolvedValue(userDoc("disabled"));

    await expect(refresh(await presented(), ctx)).rejects.toThrow();
    expect(repo.createRefreshToken).not.toHaveBeenCalled();
  });

  it("gets nothing for a session the shop's idle timeout has ended", async () => {
    rotatedAgo(3 * SECONDS);
    repo.findSessionById.mockResolvedValue({
      _id: "session-1",
      lastSeenAt: new Date(Date.now() - 2 * 60 * 60_000),
    });

    await expect(refresh(await presented(), ctx)).rejects.toThrow("Session timed out");
    expect(repo.createRefreshToken).not.toHaveBeenCalled();
  });
});

/**
 * The window re-issues while the session ROW stands, so every way of ending a
 * session must delete the row BEFORE it stamps the chain — otherwise a beat
 * landing between the two reads as a lost answer and is given a new token.
 */
describe("ending a session removes the row before revoking the chain", () => {
  const first = (a: { mock: { invocationCallOrder: number[] } }) => a.mock.invocationCallOrder[0];

  it("when a refresh ends it", async () => {
    rotatedAgo(20 * SECONDS);
    await refresh(await presented(), ctx).catch(() => undefined);
    expect(first(repo.deleteSession)).toBeLessThan(first(repo.revokeRefreshTokensBySession));
  });

  it("when the admin signs out", async () => {
    await logout(await presented(), ctx);
    expect(first(repo.deleteSession)).toBeLessThan(first(repo.revokeRefreshTokensBySession));
  });

  it("when the password is changed", async () => {
    await changePassword(
      "user-1",
      { currentPassword: "old-Passw0rd", newPassword: "new-Passw0rd", confirmPassword: "new-Passw0rd" } as never,
      ctx,
    );
    expect(first(repo.deleteSessionsByUser)).toBeLessThan(first(repo.revokeRefreshTokensByUser));
  });
});
