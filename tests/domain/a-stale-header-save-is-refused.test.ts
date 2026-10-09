/**
 * THE LAPTOP LEFT OPEN SINCE MORNING SAVED ITS MORNING HEADER OVER NOON'S.
 *
 * Header, footer, appearance and SEO are whole-document replaces built from a
 * cache filled once per admin session, and the server wrote whatever arrived.
 * A phone edit at noon was silently undone by a laptop save at three, and both
 * screens said "saved".
 *
 * The server now carries a version and refuses a stale one (409); the client
 * puts the server's copy in its cache, so the screen shows the noon change and
 * a second save builds on it. The fake server below enforces the version the
 * way `writeVersioned` does.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({ value: null as Record<string, unknown> | null, version: 1 }));

function respond(status: number, data: unknown) {
  return Promise.resolve({
    ok: status < 300,
    status,
    headers: new Headers({ "X-Content-Version": String(server.version) }),
    json: () => Promise.resolve({ success: status < 300, data }),
  } as unknown as Response);
}

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (!String(url).includes("/api/site-layout/header")) return respond(200, server.value ?? {});
      if (!init?.method || init.method === "GET") return respond(200, server.value);
      const sent = (init.headers as Record<string, string>)["X-Content-Version"];
      if (sent !== undefined && Number(sent) !== server.version) return respond(409, null);
      server.value = JSON.parse(String(init.body));
      server.version += 1;
      return respond(200, server.value);
    }),
  );
});

describe("a header saved from a stale tab", () => {
  it("is refused, shows the other device's change, and the retry keeps it", async () => {
    const { defaultHeaderSettings } = await import("@/features/site-layout/lib/header-utils");
    const { ensureSiteLayoutHydrated } = await import("@/components/shared/site-layout-server-sync");
    const repo = await import("@/features/site-layout/lib/header-repository");

    server.value = { ...defaultHeaderSettings, announcementText: "Morning" } as Record<string, unknown>;
    server.version = 1;
    expect(await ensureSiteLayoutHydrated()).toBe(true);

    // Noon, on the phone: the announcement changes.
    server.value = { ...server.value, announcementText: "Fresh at noon" };
    server.version += 1;

    // Three o'clock, on the laptop: a different field, from the morning copy.
    const stale = repo.loadHeaderSettings();
    const refused = await repo.saveHeaderSettings({ ...stale, phone: "+91 99999 00000" } as never);
    expect(refused.persisted).toBe(false);
    expect((server.value as { phone?: string }).phone).not.toBe("+91 99999 00000");

    // The laptop's cache now holds the noon change, so the retry keeps it.
    const fresh = repo.loadHeaderSettings() as unknown as { announcementText: string };
    expect(fresh.announcementText).toBe("Fresh at noon");
    const retried = await repo.saveHeaderSettings({ ...repo.loadHeaderSettings(), phone: "+91 99999 00000" } as never);
    expect(retried.persisted).toBe(true);
    expect(server.value).toMatchObject({ announcementText: "Fresh at noon", phone: "+91 99999 00000" });
  });
});
