import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Two things the settings write endpoints have to get right, and did not.
 *
 * 1. THE MAIL PASSWORD MUST NOT CROSS THE HTTP BOUNDARY — ON ANY RESPONSE.
 *    `redactMailPassword` was applied at exactly one of the three places that
 *    hand the settings document to a browser: the GET. Both write endpoints
 *    returned the document whole, so saving ANY section — Google Analytics ids,
 *    social links, the tax rate — answered with the shop's live SMTP credential
 *    in cleartext in the response body.
 *
 * 2. THE SECTION NAME IS AN ALLOWLIST, AND `in` IS NOT ONE.
 *    `"__proto__" in SECTION_DEFAULTS` is true, and so are `constructor`,
 *    `toString` and `valueOf`. The reset endpoint let all of them through and
 *    answered 200 "Settings reset" for a section that does not exist, writing an
 *    audit row to match; the update endpoint indexed the schema map the same way
 *    and handed `Object.prototype` to the validator, which crashed it into a 500.
 */
const SETTINGS = {
  general: { siteName: "Real Shop", currency: "INR" },
  analytics: { googleAnalyticsId: "G-REAL" },
  smtp: {
    host: "smtp.example.com",
    port: 587,
    username: "shop",
    password: "a-real-live-secret",
    encryption: "tls",
    enabled: true,
    fromEmail: "shop@example.com",
    fromName: "Shop",
  },
};

const service = vi.hoisted(() => ({
  getSettings: vi.fn(async () => structuredClone(SETTINGS_REF.value)),
  updateSection: vi.fn(async () => structuredClone(SETTINGS_REF.value)),
  resetSection: vi.fn(async (section: string) => {
    if (!Object.hasOwn(SETTINGS_REF.value, section)) {
      const { NotFoundError } = await import("@/lib/server/http/errors");
      throw new NotFoundError("Unknown settings section");
    }
    return structuredClone(SETTINGS_REF.value);
  }),
  getPublicSettings: vi.fn(async () => ({})),
  getLabels: vi.fn(async () => ({})),
}));

const SETTINGS_REF = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
SETTINGS_REF.value = SETTINGS;

vi.mock("@/features/settings/server/settings.service", () => service);
vi.mock("@/lib/server/auth/dal", () => ({
  requireRole: vi.fn(async () => ({ sub: "u1", email: "owner@example.com", role: "owner" })),
  getSession: vi.fn(async () => ({ sub: "u1", email: "owner@example.com", role: "owner" })),
}));
vi.mock("@/lib/server/audit/audit-log", () => ({
  requestContext: () => ({ ip: "127.0.0.1", userAgent: "test" }),
  writeAuditLog: vi.fn(async () => undefined),
}));
vi.mock("@/lib/server/mail/send-test-email", () => ({ sendTestEmail: vi.fn(async () => undefined) }));

import {
  getSettingsController,
  resetSectionController,
  updateSectionController,
} from "@/features/settings/server/settings.controller";

const req = (body?: unknown) =>
  new Request("http://localhost/api/settings", {
    method: body === undefined ? "POST" : "PUT",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const ctx = (section: string) => ({ params: Promise.resolve({ section }) });

interface SettingsBody {
  success: boolean;
  data: { smtp: { password: string; passwordSet: boolean } } | null;
}

async function bodyOf(res: Response) {
  return (await res.json()) as SettingsBody;
}

describe("the mail password never leaves the server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    SETTINGS_REF.value = structuredClone(SETTINGS);
  });

  it("is redacted on the admin read", async () => {
    const body = await bodyOf(await getSettingsController());

    expect(body.data!.smtp.password).toBe("");
    expect(body.data!.smtp.passwordSet).toBe(true);
  });

  it("is redacted on a section SAVE that has nothing to do with mail", async () => {
    const res = await updateSectionController(
      req({ googleAnalyticsId: "G-NEW", googleTagManagerId: "", facebookPixelId: "", hotjarId: "" }),
      ctx("analytics"),
    );
    const body = await bodyOf(res);

    expect(res.status).toBe(200);
    expect(body.data!.smtp.password).toBe("");
    // And the whole response, serialised, carries no trace of it — a nested
    // copy somewhere else in the document would defeat the field check above.
    expect(JSON.stringify(body)).not.toContain("a-real-live-secret");
  });

  it("is redacted on a section RESET", async () => {
    const res = await resetSectionController(req(), ctx("analytics"));

    expect(res.status).toBe(200);
    expect(JSON.stringify(await bodyOf(res))).not.toContain("a-real-live-secret");
  });

  it("still tells the form whether a password is stored", async () => {
    SETTINGS_REF.value = { ...structuredClone(SETTINGS), smtp: { ...SETTINGS.smtp, password: "" } };

    const body = await bodyOf(await getSettingsController());

    expect(body.data!.smtp.passwordSet).toBe(false);
  });
});

describe("the section name is an allowlist, not a property lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    SETTINGS_REF.value = structuredClone(SETTINGS);
  });

  const inherited = ["__proto__", "constructor", "toString", "valueOf", "hasOwnProperty"];

  for (const key of inherited) {
    it(`refuses to update "${key}" with a 404, not a 500`, async () => {
      const res = await updateSectionController(req({ anything: true }), ctx(key));

      expect(res.status).toBe(404);
      expect(service.updateSection).not.toHaveBeenCalled();
    });

  }
  // The reset allowlist lives in the SERVICE, next to the defaults it indexes —
  // see `resets refuse a section that only exists on Object.prototype` in
  // settings-reset-allowlist.test.ts, which exercises the real guard rather
  // than the mock standing in for it here.

  it("still accepts a real section", async () => {
    const res = await updateSectionController(
      req({ googleAnalyticsId: "G-OK", googleTagManagerId: "", facebookPixelId: "", hotjarId: "" }),
      ctx("analytics"),
    );

    expect(res.status).toBe(200);
    expect(service.updateSection).toHaveBeenCalledOnce();
  });

  it("still rejects a body the section schema refuses", async () => {
    const res = await updateSectionController(req({ googleAnalyticsId: 42 }), ctx("analytics"));

    expect(res.status).toBe(422);
    expect(service.updateSection).not.toHaveBeenCalled();
  });
});
