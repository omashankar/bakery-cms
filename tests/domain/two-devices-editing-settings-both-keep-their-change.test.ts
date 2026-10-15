/**
 * THE LAPTOP'S MORNING COPY OVERWROTE THE PHONE'S NOON DELIVERY FEE.
 *
 * A settings section is saved whole, from a browser cache filled once per
 * admin session, and the server wrote whatever arrived. At noon the owner
 * raised the delivery fee from 50 to 80 on a phone; at three, on a laptop open
 * since morning, they changed the gift-wrap fee — and the delivery fee went
 * back to 50, with a "saved" toast.
 *
 * The server now versions each section and refuses a stale save (409). The
 * client then merges: it keeps the fields THIS form changed and takes the
 * server's value for the rest, and saves once more. The fake server below
 * enforces the version the way `updateSection` does.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultAppSettings } from "@/features/settings/lib/settings-utils";

const server = vi.hoisted(() => ({
  settings: null as Record<string, unknown> | null,
  versions: {} as Record<string, number>,
}));

function respond(status: number, data: unknown) {
  return Promise.resolve({
    ok: status < 300,
    status,
    headers: new Headers(),
    json: () => Promise.resolve({ success: status < 300, data }),
  } as unknown as Response);
}

function full() {
  return { ...server.settings, sectionVersions: { ...server.versions } };
}

beforeEach(() => {
  localStorage.clear();
  server.settings = JSON.parse(JSON.stringify(defaultAppSettings));
  server.versions = { commerce: 3 };
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      const path = String(url);
      if (path === "/api/settings" && (!init?.method || init.method === "GET")) return respond(200, full());
      const match = /^\/api\/settings\/([a-zA-Z]+)$/.exec(path);
      if (match && init?.method === "PUT") {
        const section = match[1];
        const sent = (init.headers as Record<string, string>)["X-Section-Version"];
        if (sent !== undefined && Number(sent) !== (server.versions[section] ?? 0)) return respond(409, null);
        server.settings = { ...server.settings, [section]: JSON.parse(String(init.body)) };
        server.versions[section] = (server.versions[section] ?? 0) + 1;
        return respond(200, full());
      }
      return respond(200, {});
    }),
  );
});

describe("two devices editing one settings section", () => {
  it("keeps both changes: the phone's delivery fee and the laptop's gift wrap", async () => {
    const repo = await import("@/features/settings/lib/settings-repository");

    // Morning: the laptop loads the settings.
    expect(await repo.ensureSettingsHydrated()).toBe(true);
    const morning = repo.getCommerceSettings();

    // Noon, on the phone: the delivery fee goes from its old value to 80.
    const commerce = server.settings!.commerce as Record<string, unknown>;
    server.settings = { ...server.settings, commerce: { ...commerce, deliveryFee: 80 } };
    server.versions.commerce += 1;

    // Three o'clock, on the laptop: the gift-wrap fee, from the morning form.
    const result = await repo.saveCommerceSettings({ ...morning, giftWrapFee: 45 });

    expect(result.persisted).toBe(true);
    const stored = server.settings!.commerce as Record<string, unknown>;
    expect(stored.deliveryFee).toBe(80);
    expect(stored.giftWrapFee).toBe(45);
    expect(repo.getCommerceSettings()).toMatchObject({ deliveryFee: 80, giftWrapFee: 45 });
  });
});

describe("rebaseSection", () => {
  it("takes my changed fields and their value for everything else", async () => {
    const { rebaseSection } = await import("@/features/settings/lib/settings-repository");
    const base = { a: 1, b: 1, c: 1 };
    expect(rebaseSection(base, { a: 2, b: 1, c: 1 }, { a: 1, b: 9, c: 1 })).toEqual({ a: 2, b: 9, c: 1 });
  });

  it("gives a field both changed to the one saving now", async () => {
    const { rebaseSection } = await import("@/features/settings/lib/settings-repository");
    expect(rebaseSection({ a: 1 }, { a: 2 }, { a: 3 })).toEqual({ a: 2 });
  });

  it("treats a list as one value", async () => {
    const { rebaseSection } = await import("@/features/settings/lib/settings-repository");
    expect(rebaseSection([1], [1], [1, 2])).toEqual([1, 2]);
    expect(rebaseSection([1], [3], [1, 2])).toEqual([3]);
  });
});
