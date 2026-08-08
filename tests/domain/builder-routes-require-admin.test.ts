import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Every verb of both builder endpoints is owner/admin only, including the read.
 *
 * The GET used to be open, justified in the file's own header as storefront
 * data. It is not: the storefront renders on the server and calls
 * `getHomepageState()` in-process, so the only caller of this URL is the admin
 * builder. What an anonymous `curl` got back was `state.draft` — every headline,
 * image and price the admin was still working on — plus
 * `draft.scheduledPublishAt`, the exact minute an unannounced campaign was set
 * to go live, and once the shop had published once, the inline `revisions` log
 * with it.
 *
 * The sibling route at /api/builders/homepage/revisions had already reasoned
 * about this and guarded its own read, noting it was "builder-internal data, not
 * storefront copy, so unlike /api/homepage-sections the read is guarded too".
 * The thing it declined to guard was returning the draft.
 */

const guard = vi.hoisted(() => ({ requireAdminResponse: vi.fn() }));
vi.mock("@/lib/server/auth/guard", () => guard);

const state = {
  draft: { sections: [], updatedAt: "" },
  published: { sections: [], updatedAt: "" },
  version: 3,
};
const written = { snapshot: state.draft, version: 4 };

vi.mock("@/features/cms-sections/data/homepage-sections.server", () => ({
  getHomepageState: vi.fn(async () => state),
  publishSections: vi.fn(async () => written),
  resetHomepageSections: vi.fn(async () => state),
  saveDraftSections: vi.fn(async () => written),
}));

vi.mock("@/features/cms-sections/data/wedding-sections.server", () => ({
  getWeddingState: vi.fn(async () => state),
  publishWeddingSections: vi.fn(async () => written),
  resetWeddingSections: vi.fn(async () => state),
  saveWeddingDraft: vi.fn(async () => written),
}));

import * as homepageRoute from "@/app/api/homepage-sections/route";
import * as weddingRoute from "@/app/api/wedding-sections/route";

const ROUTES = [
  { what: "/api/homepage-sections", route: homepageRoute },
  { what: "/api/wedding-sections", route: weddingRoute },
] as const;

function signedOut() {
  guard.requireAdminResponse.mockResolvedValue(
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  );
}

function signedIn() {
  guard.requireAdminResponse.mockResolvedValue({ sub: "admin-1", role: "admin" });
}

function put(body: unknown) {
  return new Request("http://localhost/api/x", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

describe.each(ROUTES)("$what", ({ route }) => {
  beforeEach(() => {
    guard.requireAdminResponse.mockReset();
  });

  it("refuses to hand the unpublished draft to a signed-out caller", async () => {
    signedOut();

    const response = await route.GET();

    expect(response.status).toBe(401);
    // Not just a status: nothing of the draft may be in the body.
    expect(await response.json()).not.toHaveProperty("state");
  });

  it("serves the state to an admin", async () => {
    signedIn();

    const response = await route.GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty("state");
  });

  it("still refuses writes from a signed-out caller", async () => {
    signedOut();

    expect((await route.PUT(put({ sections: [] }))).status).toBe(401);
    expect((await route.POST(put({ sections: [] }))).status).toBe(401);
  });

  it("checks the caller before reading anything", async () => {
    signedOut();

    await route.GET();

    expect(guard.requireAdminResponse).toHaveBeenCalledTimes(1);
  });

  it("hands back the version a write landed on, so the next one can carry it", async () => {
    signedIn();

    const body = await (await route.PUT(put({ sections: [] }))).json();

    expect(body.version).toBe(4);
  });
});
