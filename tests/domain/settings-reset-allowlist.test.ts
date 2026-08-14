import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `in` is not an allowlist.
 *
 * `resetSection` guarded itself with `section in SECTION_DEFAULTS`, and the `in`
 * operator walks the prototype chain — so `__proto__`, `constructor`,
 * `toString`, `valueOf` and `hasOwnProperty` all answered true. Each one then
 * took `SECTION_DEFAULTS[section]` (a function, or `Object.prototype` itself)
 * into `doc.set()` and came back 200 "Settings reset".
 *
 * Mongoose's strict schema dropped the write, so no setting was damaged. What
 * was left behind is worse than harmless: an endpoint reporting a reset that
 * never happened, and an audit row — `settings.reset.__proto__` — recording it
 * in the same trail the Security Center and the Activity screen read as the
 * record of what was done to this shop.
 */
const repo = vi.hoisted(() => ({
  updateSection: vi.fn(async () => ({ toJSON: () => ({ general: { businessType: "bakery" } }) })),
  getOrCreateSettings: vi.fn(async () => ({ toJSON: () => ({}) })),
}));
const audit = vi.hoisted(() => ({
  writeAuditLog: vi.fn(async (_entry: { action: string }) => undefined),
}));

vi.mock("@/features/settings/server/settings.repository", () => repo);
vi.mock("@/lib/server/audit/audit-log", () => ({
  ...audit,
  requestContext: () => ({ ip: "127.0.0.1", userAgent: "test" }),
}));
vi.mock("@/lib/server/mail/mailer", () => ({ resetMailTransport: vi.fn() }));

import { resetSection } from "@/features/settings/server/settings.service";

const ctx = { ip: "127.0.0.1", userAgent: "test", actorId: "u1", actorEmail: "owner@example.com" };

describe("resets refuse a section that only exists on Object.prototype", () => {
  beforeEach(() => vi.clearAllMocks());

  for (const key of ["__proto__", "constructor", "toString", "valueOf", "hasOwnProperty"]) {
    it(`rejects "${key}"`, async () => {
      await expect(resetSection(key, ctx)).rejects.toThrow(/unknown settings section/i);

      // Nothing written, and above all nothing CLAIMED: an audit row for a
      // section that does not exist is a fabricated entry in the shop's record.
      expect(repo.updateSection).not.toHaveBeenCalled();
      expect(audit.writeAuditLog).not.toHaveBeenCalled();
    });
  }

  it("still resets a real section", async () => {
    await resetSection("analytics", ctx);

    expect(repo.updateSection).toHaveBeenCalledOnce();
    expect(audit.writeAuditLog).toHaveBeenCalledOnce();
    expect(audit.writeAuditLog.mock.calls[0][0]).toMatchObject({
      action: "settings.reset.analytics",
    });
  });

  it("rejects a plausible-looking name that is simply not a section", async () => {
    await expect(resetSection("smtp.password", ctx)).rejects.toThrow(/unknown settings section/i);
    await expect(resetSection("key", ctx)).rejects.toThrow(/unknown settings section/i);
  });
});
