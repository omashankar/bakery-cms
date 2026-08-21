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
/**
 * The mail transport, which this mocked at a path that does not exist.
 *
 * It named `@/lib/server/mail/mailer`. There is no such module — the transport
 * lives in `@/lib/server/mail/transport` — so vitest stubbed nothing, the real
 * one was loaded, and the line read as protection while providing none. It was
 * never noticed because no test here reset the one section that reaches it.
 */
const mail = vi.hoisted(() => ({ resetMailTransport: vi.fn() }));
vi.mock("@/lib/server/mail/transport", () => mail);

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

  /**
   * And the one section with a side effect beyond the document.
   *
   * `getMailTransport` caches the built transport, so restoring the SMTP
   * defaults without dropping that cache leaves the shop mailing through the
   * credentials the admin just cleared — for the life of the process, with the
   * settings screen showing the reset values. This is also what makes the mock
   * above load-bearing: nothing here reset `smtp` before, which is why it went
   * years pointing at a module that was never there.
   */
  it("drops the cached mail transport when the SMTP section is reset", async () => {
    await resetSection("smtp", ctx);

    expect(repo.updateSection).toHaveBeenCalledOnce();
    expect(
      mail.resetMailTransport,
      "the shop keeps sending through the credentials that were just cleared",
    ).toHaveBeenCalledOnce();
  });
});
