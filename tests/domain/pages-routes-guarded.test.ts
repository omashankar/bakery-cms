import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CmsPage } from "@/types/content";

/**
 * Every verb of the CMS page endpoints is owner/admin only, and the two rules the
 * admin UI promises are enforced where they can be relied on.
 *
 * Three holes, all on the same pair of routes:
 *
 * - GET was open on both. `getPages` returns every page whatever its status, so
 *   an anonymous `curl` received the full body of every draft and archived page,
 *   its SEO fields, and `scheduledPublishAt` — the exact minute of an
 *   unannounced launch. The storefront never calls it; it reads the store
 *   in-process and filters to published.
 * - POST refused a duplicate slug; its PUT twin did not. Storefront lookup is a
 *   first-match `.find()` and new pages are prepended, so retyping a page's slug
 *   as "about" put that page's body on /store/about under the About Us route.
 * - "System pages cannot be removed" was enforced only in the browser. The route
 *   deleted any id, so About Us, Privacy Policy and Terms of Service could all be
 *   removed by a scripted call, leaving three storefront routes with nothing
 *   behind them.
 */

const guard = vi.hoisted(() => ({ requireAdminResponse: vi.fn() }));
vi.mock("@/lib/server/auth/guard", () => guard);

const store = vi.hoisted(() => ({
  pages: [] as CmsPage[],
}));

vi.mock("@/features/content/data/pages.server", () => ({
  getPages: vi.fn(async () => store.pages),
  getPageById: vi.fn(async (id: string) => store.pages.find((p) => p.id === id) ?? null),
  createPage: vi.fn(async (data: CmsPage) => data),
  updatePage: vi.fn(async (id: string, patch: Partial<CmsPage>) => {
    const page = store.pages.find((p) => p.id === id);
    return page ? { ...page, ...patch } : null;
  }),
  deletePage: vi.fn(async (id: string) => store.pages.some((p) => p.id === id)),
}));

import * as collection from "@/app/api/pages/route";
import * as item from "@/app/api/pages/[id]/route";

function page(over: Partial<CmsPage> & { id: string; slug: string }): CmsPage {
  return {
    title: over.slug,
    description: "",
    template: "standard",
    blocks: [],
    status: "published",
    isSystem: false,
    sortOrder: 1,
    createdAt: "",
    updatedAt: "",
    ...over,
  } as CmsPage;
}

function body(value: unknown, method: string) {
  // GET/HEAD may not carry one.
  return new Request("http://localhost/api/pages", {
    method,
    ...(method === "GET" || method === "HEAD" ? {} : { body: JSON.stringify(value) }),
  });
}

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });

function signedOut() {
  guard.requireAdminResponse.mockResolvedValue(
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  );
}
function signedIn() {
  guard.requireAdminResponse.mockResolvedValue({ sub: "u1", role: "admin" });
}

beforeEach(() => {
  guard.requireAdminResponse.mockReset();
  store.pages = [
    page({ id: "page-about", slug: "about", isSystem: true }),
    page({ id: "page-draft", slug: "corporate-catering", status: "draft" }),
    page({ id: "page-careers", slug: "careers" }),
  ];
});

describe("the CMS page endpoints", () => {
  it("refuses to list pages for a signed-out caller", async () => {
    signedOut();

    const response = await collection.GET();

    expect(response.status).toBe(401);
    expect(await response.json()).not.toHaveProperty("pages");
  });

  it("refuses to hand over a single page either", async () => {
    signedOut();

    const response = await item.GET(body(null, "GET"), ctx("page-draft"));

    expect(response.status).toBe(401);
    expect(await response.json()).not.toHaveProperty("page");
  });

  it("serves them to an admin", async () => {
    signedIn();

    expect((await collection.GET()).status).toBe(200);
    expect((await item.GET(body(null, "GET"), ctx("page-about"))).status).toBe(200);
  });

  it("still refuses every write from a signed-out caller", async () => {
    signedOut();

    expect((await collection.POST(body({ title: "x", slug: "x" }, "POST"))).status).toBe(401);
    expect((await item.PUT(body({ title: "x" }, "PUT"), ctx("page-careers"))).status).toBe(401);
    expect((await item.DELETE(body(null, "DELETE"), ctx("page-careers"))).status).toBe(401);
  });

  describe("slugs", () => {
    it("refuses to create one that is taken", async () => {
      signedIn();

      const response = await collection.POST(body({ title: "New", slug: "about" }, "POST"));

      expect(response.status).toBe(409);
    });

    it("refuses to RENAME one onto a slug that is taken", async () => {
      signedIn();

      const response = await item.PUT(body({ slug: "about" }, "PUT"), ctx("page-careers"));

      expect(response.status).toBe(409);
      expect((await response.json()).error).toMatch(/already in use/i);
    });

    it("lets a page keep its own slug", async () => {
      signedIn();

      const response = await item.PUT(
        body({ slug: "careers", title: "Careers" }, "PUT"),
        ctx("page-careers"),
      );

      expect(response.status).toBe(200);
    });

    it("allows an edit that does not touch the slug", async () => {
      signedIn();

      expect((await item.PUT(body({ title: "Renamed" }, "PUT"), ctx("page-about"))).status).toBe(
        200,
      );
    });
  });

  describe("system pages", () => {
    it("refuses to delete one", async () => {
      signedIn();

      const response = await item.DELETE(body(null, "DELETE"), ctx("page-about"));

      expect(response.status).toBe(403);
      expect((await response.json()).error).toMatch(/system/i);
    });

    it("still deletes an ordinary page", async () => {
      signedIn();

      expect((await item.DELETE(body(null, "DELETE"), ctx("page-careers"))).status).toBe(200);
    });

    it("answers 404 for one that is not there", async () => {
      signedIn();

      expect((await item.DELETE(body(null, "DELETE"), ctx("page-nope"))).status).toBe(404);
    });
  });
});
