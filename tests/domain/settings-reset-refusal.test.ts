import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultAppSettings } from "@/features/settings/lib/settings-utils";
import type {
  AnalyticsSettings,
  CommerceSettings,
  ContactSettings,
  GeneralSettings,
  MaintenanceSettings,
  ModuleSettings,
  SecuritySettings,
  SmtpSettings,
  SocialLinkSettings,
} from "@/types/settings";

/**
 * What a settings form shows after a reset the SERVER refused.
 *
 * `runWrite` commits whatever the reset function returns as the form's working
 * copy, whether or not the server took it — it has to, because on a refused
 * SAVE that value is the admin's own typing and they must be able to retry it.
 * A reset is not typing. Returning the defaults after a refusal put the demo
 * values on screen over settings the shop still had: the toast said "the saved
 * settings are unchanged" while the fields said the opposite, and the admin's
 * next Save pushed those defaults up for real.
 *
 * Four of the nine resets were repaired for this one at a time and five were
 * left behind — Commerce among them, which carries the tax rate, the delivery
 * fee, the minimum order value and which payment methods are switched on.
 */
async function freshModules() {
  vi.resetModules();
  const api = await import("@/features/settings/lib/settings-api");
  const repo = await import("@/features/settings/lib/settings-repository");
  return { api, repo };
}

/** The shop's real settings, as the server holds them. */
const SERVER = {
  ...defaultAppSettings,
  general: { ...defaultAppSettings.general, siteName: "Real Shop" },
  contact: { ...defaultAppSettings.contact, phone: "+91 90000 00000" },
  social: defaultAppSettings.social.map((l) => ({ ...l, href: "https://real.example.com" })),
  security: { ...defaultAppSettings.security, sessionTimeoutMinutes: 45 },
  smtp: { ...defaultAppSettings.smtp, host: "smtp.real.example.com" },
  analytics: { ...defaultAppSettings.analytics, googleAnalyticsId: "G-REAL" },
  maintenance: { ...defaultAppSettings.maintenance, message: "Back at nine" },
  commerce: { ...defaultAppSettings.commerce, deliveryFee: 199, taxRate: 0.05, minOrderValue: 750 },
  /**
   * `flavour`, not `weddingBuilder`.
   *
   * The case below asserts a stored value survives a refused reset, so it has to
   * DIFFER from the default — and the test guards that itself, which is how it
   * caught two changes to the wedding default in a row. Wedding is the one
   * module whose default has moved, so pinning this case to it made an unrelated
   * policy decision able to break a test about reset refusal. `flavour` has
   * defaulted true throughout and has no reason to move.
   */
  modules: { ...defaultAppSettings.modules, flavour: false },
};

/** Hydration always succeeds; every section PUT is refused. */
function serverRefusesWrites() {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (method === "GET" && url === "/api/settings") {
      return { ok: true, status: 200, json: async () => ({ success: true, data: SERVER }) };
    }
    if (method === "GET" && url === "/api/settings/public") {
      return { ok: true, status: 200, json: async () => ({ success: true, data: SERVER }) };
    }
    return { ok: false, status: 500, json: async () => ({ success: false, data: null }) };
  });
  vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
  return fetchMock;
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("a reset the server refused", () => {
  const cases: {
    name: string;
    reset: (r: typeof import("@/features/settings/lib/settings-repository")) => Promise<{
      value: unknown;
      persisted: boolean;
    }>;
    /** What the shop still has, which is what the form must go on showing. */
    kept: (value: unknown) => unknown;
    serverValue: unknown;
    defaultValue: unknown;
  }[] = [
    {
      name: "General",
      reset: (r) => r.resetGeneralSettings(),
      kept: (v) => (v as GeneralSettings).siteName,
      serverValue: SERVER.general.siteName,
      defaultValue: defaultAppSettings.general.siteName,
    },
    {
      name: "Contact",
      reset: (r) => r.resetContactSettings(),
      kept: (v) => (v as ContactSettings).phone,
      serverValue: SERVER.contact.phone,
      defaultValue: defaultAppSettings.contact.phone,
    },
    {
      name: "Social",
      reset: (r) => r.resetSocialLinks(),
      kept: (v) => (v as SocialLinkSettings[])[0].href,
      serverValue: SERVER.social[0].href,
      defaultValue: defaultAppSettings.social[0].href,
    },
    {
      name: "Security",
      reset: (r) => r.resetSecuritySettings(),
      kept: (v) => (v as SecuritySettings).sessionTimeoutMinutes,
      serverValue: SERVER.security.sessionTimeoutMinutes,
      defaultValue: defaultAppSettings.security.sessionTimeoutMinutes,
    },
    {
      name: "SMTP",
      reset: (r) => r.resetSmtpSettings(),
      kept: (v) => (v as SmtpSettings).host,
      serverValue: SERVER.smtp.host,
      defaultValue: defaultAppSettings.smtp.host,
    },
    {
      name: "Analytics",
      reset: (r) => r.resetAnalyticsSettings(),
      kept: (v) => (v as AnalyticsSettings).googleAnalyticsId,
      serverValue: SERVER.analytics.googleAnalyticsId,
      defaultValue: defaultAppSettings.analytics.googleAnalyticsId,
    },
    {
      name: "Maintenance",
      reset: (r) => r.resetMaintenanceSettings(),
      kept: (v) => (v as MaintenanceSettings).message,
      serverValue: SERVER.maintenance.message,
      defaultValue: defaultAppSettings.maintenance.message,
    },
    {
      name: "Commerce",
      reset: (r) => r.resetCommerceSettings(),
      kept: (v) => (v as CommerceSettings).deliveryFee,
      serverValue: SERVER.commerce.deliveryFee,
      defaultValue: defaultAppSettings.commerce.deliveryFee,
    },
    {
      name: "Modules",
      reset: (r) => r.resetModuleSettings(),
      kept: (v) => (v as ModuleSettings).flavour,
      serverValue: SERVER.modules.flavour,
      defaultValue: defaultAppSettings.modules.flavour,
    },
  ];

  for (const c of cases) {
    it(`leaves ${c.name} showing what the shop still has, not the demo defaults`, async () => {
      const { repo } = await freshModules();
      serverRefusesWrites();
      // Hydrate first, so the local copy IS the shop's real settings.
      await repo.hydrateSettingsFromServer();

      const result = await c.reset(repo);

      expect(result.persisted).toBe(false);
      // The distinction only means something if the two differ.
      expect(c.serverValue).not.toEqual(c.defaultValue);
      expect(c.kept(result.value)).toEqual(c.serverValue);
    });
  }

  it("still hands back the defaults when the server ACCEPTED the reset", async () => {
    const { repo } = await freshModules();
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "GET") {
        return { ok: true, status: 200, json: async () => ({ success: true, data: SERVER }) };
      }
      return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    await repo.hydrateSettingsFromServer();

    const result = await repo.resetCommerceSettings();

    expect(result.persisted).toBe(true);
    expect((result.value as CommerceSettings).deliveryFee).toBe(defaultAppSettings.commerce.deliveryFee);
  });
});

/**
 * A reset is a RESET, not a PUT of the defaults.
 *
 * For eight sections those are the same thing. For SMTP they are not:
 * `defaultSmtpSettings.password` is `""`, and the server reads a blank password
 * as "keep the stored one" — a rule that has to exist, because the form is
 * never sent the password back and would otherwise wipe a working credential
 * every time somebody toggled `enabled`. So Reset wrote the demo host, port and
 * username with the shop's OLD password reattached, told the admin "SMTP
 * settings reset to defaults", and flipped the hint to "No password saved"
 * while the mail transport went on authenticating with it.
 */
describe("how a reset reaches the server", () => {
  function recordingServer() {
    const calls: { url: string; method: string }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        calls.push({ url, method });
        if (method === "GET") {
          return { ok: true, status: 200, json: async () => ({ success: true, data: SERVER }) };
        }
        return { ok: true, status: 200, json: async () => ({ success: true, data: {} }) };
      }) as unknown as typeof fetch,
    );
    return calls;
  }

  it("posts to the section's reset endpoint and never PUTs the defaults", async () => {
    const { repo } = await freshModules();
    const calls = recordingServer();
    await repo.hydrateSettingsFromServer();

    const result = await repo.resetSmtpSettings();

    expect(result.persisted).toBe(true);
    expect(calls).toContainEqual({ url: "/api/settings/smtp/reset", method: "POST" });
    // A PUT here is the bug: the server would re-attach the stored password.
    expect(calls.filter((c) => c.url === "/api/settings/smtp" && c.method === "PUT")).toEqual([]);
  });

  it("does it for every section, not just the one that needed it", async () => {
    const { repo } = await freshModules();
    const calls = recordingServer();
    await repo.hydrateSettingsFromServer();

    for (const [section, reset] of [
      ["general", repo.resetGeneralSettings],
      ["contact", repo.resetContactSettings],
      ["social", repo.resetSocialLinks],
      ["security", repo.resetSecuritySettings],
      ["smtp", repo.resetSmtpSettings],
      ["analytics", repo.resetAnalyticsSettings],
      ["maintenance", repo.resetMaintenanceSettings],
      ["commerce", repo.resetCommerceSettings],
      ["modules", repo.resetModuleSettings],
    ] as const) {
      await reset();
      expect(calls, section).toContainEqual({
        url: `/api/settings/${section}/reset`,
        method: "POST",
      });
    }

    expect(calls.filter((c) => c.method === "PUT")).toEqual([]);
  });

  it("applies the defaults locally once the server has taken it", async () => {
    const { repo } = await freshModules();
    recordingServer();
    await repo.hydrateSettingsFromServer();
    expect(repo.getCommerceSettings().deliveryFee).toBe(SERVER.commerce.deliveryFee);

    await repo.resetCommerceSettings();

    expect(repo.getCommerceSettings().deliveryFee).toBe(defaultAppSettings.commerce.deliveryFee);
  });
});
