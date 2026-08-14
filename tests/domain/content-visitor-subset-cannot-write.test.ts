import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A visitor's view of the shop's content must never become a replace-all write.
 *
 * `/api/content/[key]` answers two different things with the same shape. Staff
 * get the whole collection; a visitor gets only what a visitor may see —
 * approved testimonials, published FAQs, banners that are switched on, in
 * schedule and unexpired. The browser could not tell them apart, cached both
 * the same way, and every mutation here is a replace-all composed from that
 * cache.
 *
 * `ContentServerSync` mounts from `app-providers`, which wraps /login. So an
 * admin who signed in through the form hydrated while ANONYMOUS, received the
 * visitor's subset, and marked the cache trustworthy. Signing in is a soft
 * navigation, so that `[]`-dep effect never ran again and the subset stood for
 * the whole session. The first banner they edited PUT a list with every hidden
 * banner missing, and the server deleted them — along with every unpublished
 * FAQ and unapproved testimonial. The toast was green.
 *
 * The server now says which answer it gave, in `X-Content-Scope`.
 */

const BANNERS_KEY = "bakery-cms-banners";

/** The shop's real banners: one live, one switched off, one scheduled. */
const FULL = [
  { id: "b-live", title: "Live", image: "/a.jpg", isActive: true, position: "hero", priority: 0, visibility: "all" },
  { id: "b-off", title: "Switched off", image: "/b.jpg", isActive: false, position: "hero", priority: 0, visibility: "all" },
  { id: "b-soon", title: "Unannounced", image: "/c.jpg", isActive: true, position: "hero", priority: 0, visibility: "all", startDate: "2099-01-01T00:00:00.000Z" },
];

/** What an anonymous caller is given — and what a naive write would send back. */
const PUBLIC_SUBSET = [FULL[0]];

/**
 * A server that answers reads with a chosen scope and records what is PUT.
 */
function mockServer(options: { scope: "full" | "public"; body: unknown[] }) {
  const puts: unknown[][] = [];
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      puts.push(JSON.parse(String(init.body)) as unknown[]);
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ success: true, data: null }),
      } as unknown as Response;
    }
    return {
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => (name === "X-Content-Scope" ? options.scope : null),
      },
      json: async () => ({ success: true, data: options.body }),
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return { puts };
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("a cache filled by an anonymous read", () => {
  it("refuses to compose a replace-all from it", async () => {
    // The subset is in the cache, exactly as an admin arriving via /login has.
    localStorage.setItem(BANNERS_KEY, JSON.stringify(PUBLIC_SUBSET));
    const { puts } = mockServer({ scope: "public", body: PUBLIC_SUBSET });

    const { updateBanner } = await import("@/features/content/lib/banners-repository");
    const { persisted } = await updateBanner("b-live", { title: "Edited" });

    expect(persisted, "an unwritable cache reported a successful save").toBe(false);
    expect(
      puts,
      "a visitor's subset was PUT as the whole collection — the hidden banners are now deleted",
    ).toEqual([]);
  });

  it("re-reads and succeeds once the caller can see the whole collection", async () => {
    // The same admin, now authenticated: the opener fetches again, the server
    // answers `full`, and the write goes out carrying every banner.
    localStorage.setItem(BANNERS_KEY, JSON.stringify(PUBLIC_SUBSET));
    const { puts } = mockServer({ scope: "full", body: FULL });

    const { updateBanner } = await import("@/features/content/lib/banners-repository");
    const { persisted } = await updateBanner("b-live", { title: "Edited" });

    expect(persisted, "a full read still could not save").toBe(true);
    expect(puts).toHaveLength(1);

    const sent = (puts[0] as { id: string }[]).map((item) => item.id).sort();
    expect(sent, "the write dropped banners the visitor could not see").toEqual([
      "b-live",
      "b-off",
      "b-soon",
    ]);
  });

  it("keeps the switched-off and scheduled banners through a delete of one row", async () => {
    localStorage.setItem(BANNERS_KEY, JSON.stringify(PUBLIC_SUBSET));
    const { puts } = mockServer({ scope: "full", body: FULL });

    const { deleteBanners } = await import("@/features/content/lib/banners-repository");
    await deleteBanners(["b-live"]);

    const sent = (puts[0] as { id: string }[]).map((item) => item.id).sort();
    expect(sent, "deleting the live banner took the hidden ones with it").toEqual([
      "b-off",
      "b-soon",
    ]);
  });
});

describe("the scope header", () => {
  it("is not trusted when absent", async () => {
    // An older server, a proxy that strips headers, or a fetch stand-in. None
    // of those prove the answer was complete, so none may unlock a write.
    localStorage.setItem(BANNERS_KEY, JSON.stringify(PUBLIC_SUBSET));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ success: true, data: PUBLIC_SUBSET }),
      })) as unknown as typeof fetch,
    );

    const { updateBanner } = await import("@/features/content/lib/banners-repository");
    const { persisted } = await updateBanner("b-live", { title: "Edited" });

    expect(persisted, "a header-less read was treated as the whole collection").toBe(false);
  });
});

describe("the three collections", () => {
  it("do not share one gate, so one failed read cannot block the others", async () => {
    // A single `contentHydration` covered all three: a banners read that 500'd
    // made every FAQ and testimonial save report "saved on this device only"
    // for the rest of the session, for collections the server was answering.
    const api = await import("@/features/content/lib/content-api");

    api.faqsWritable.markSettled();

    expect(api.faqsWritable.hasSettled()).toBe(true);
    expect(api.bannersWritable.hasSettled(), "FAQ's gate opened banners' too").toBe(false);
    expect(api.testimonialsWritable.hasSettled(), "FAQ's gate opened testimonials' too").toBe(
      false,
    );
  });
});
