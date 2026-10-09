/**
 * TWO DEVICES, ONE BANNER LIST — AND THE RETRY ERASED THE OTHER ONE'S WORK.
 *
 * Banners, FAQs and testimonials are replace-all writes guarded by a version.
 * When the other device had saved first, this tab got a 409 — correctly — but
 * the client then re-read only the version number and threw the items away.
 * Its cache still held its stale list, so the admin's next attempt sent that
 * list with the FRESH version, the server accepted it, and the banner the
 * other device had just added was gone, under a green toast.
 *
 * The server below is a real versioned store in miniature: GET returns the
 * list and its version, PUT refuses a version that is not the current one.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Banner } from "@/types/media";

const server = vi.hoisted(() => ({ items: [] as Banner[], version: 1 }));

function banner(id: string, title: string): Banner {
  return {
    id,
    title,
    subtitle: "",
    image: "",
    ctaText: "",
    ctaLink: "",
    position: "hero",
    isActive: true,
    sortOrder: 0,
    visibility: "all",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as unknown as Banner;
}

function respond(status: number, data: unknown) {
  const headers = new Headers({ "X-Content-Version": String(server.version), "X-Content-Scope": "full" });
  return Promise.resolve({
    ok: status < 300,
    status,
    headers,
    json: () => Promise.resolve({ success: status < 300, data }),
  } as unknown as Response);
}

beforeEach(() => {
  localStorage.clear();
  server.items = [banner("b1", "Diwali sale")];
  server.version = 1;
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init?: RequestInit) => {
      if (!String(url).includes("/api/content/banners")) return respond(200, null);
      if (!init || !init.method || init.method === "GET") return respond(200, server.items);
      const sent = (init.headers as Record<string, string>)["X-Content-Version"];
      if (sent !== undefined && Number(sent) !== server.version) return respond(409, null);
      server.items = JSON.parse(String(init.body)) as Banner[];
      server.version += 1;
      return respond(200, server.items);
    }),
  );
});

describe("a save refused because another device saved first", () => {
  it("does not erase the other device's banner on the next attempt", async () => {
    const repo = await import("@/features/content/lib/banners-repository");

    // This tab loads the list: one banner, version 1.
    expect(await repo.ensureBannersWritable()).toBe(true);

    // Meanwhile, on the phone, the owner adds a Christmas banner.
    server.items = [banner("b2", "Christmas"), ...server.items];
    server.version += 1;

    // This tab adds one too. Refused: it composed against version 1.
    const first = await repo.createBanner(banner("x", "New Year") as never);
    expect(first.persisted).toBe(false);

    // And the screen now shows the phone's banner.
    expect(repo.loadBanners().map((b) => b.title)).toContain("Christmas");

    // The admin tries again — and the phone's banner survives it.
    const second = await repo.createBanner(banner("x", "New Year") as never);
    expect(second.persisted).toBe(true);
    expect(server.items.map((b) => b.title).sort()).toEqual(["Christmas", "Diwali sale", "New Year"]);
  });
});
