import { beforeEach, describe, expect, it, vi } from "vitest";

import { activeSlideIndex, type HeroSlide } from "@/features/cms-sections/hero-carousel";

const requireRole = vi.hoisted(() => vi.fn());
vi.mock("@/lib/server/auth/dal", () => ({ requireRole }));

import { canPreviewDraft } from "@/apps/website/lib/preview-access.server";

/**
 * `/store?cmsPreview=1` and `/store/wedding-cakes?cmsPreview=wedding` rendered
 * the unpublished draft to anybody who put the parameter on the URL — no session
 * check anywhere in the path. Preview links open in an ordinary tab and get
 * pasted into chats, and `generateMetadata` returns the same metadata for the
 * preview URL, so a leaked link is indexable with draft content in it.
 */
describe("who may see an unpublished draft", () => {
  beforeEach(() => {
    requireRole.mockReset();
  });

  it("lets an owner or admin through", async () => {
    requireRole.mockResolvedValue({ sub: "u1", role: "admin" });

    expect(await canPreviewDraft()).toBe(true);
    expect(requireRole).toHaveBeenCalledWith("owner", "admin");
  });

  it("turns a signed-out visitor away", async () => {
    requireRole.mockRejectedValue(new Error("Unauthorized"));

    expect(await canPreviewDraft()).toBe(false);
  });

  it("turns away a signed-in customer who is not staff", async () => {
    requireRole.mockRejectedValue(new Error("Forbidden"));

    expect(await canPreviewDraft()).toBe(false);
  });

  it("fails closed when the session check itself breaks", async () => {
    // A session store that is down must not open the draft to the world.
    requireRole.mockImplementation(() => {
      throw new Error("session store unreachable");
    });

    expect(await canPreviewDraft()).toBe(false);
  });
});

/**
 * The hero carousel's index is state and outlives a shrinking slide list.
 * Autoplay walks it to the last slide within seconds, so removing the last slide
 * in the builder left `slides[index]` undefined and `slide.badge` threw — inside
 * the builder's live preview, which has no error boundary, taking every unsaved
 * edit with it.
 */
describe("the hero carousel's active slide", () => {
  it("stays in range when the admin deletes the slide being shown", () => {
    const before: HeroSlide[] = [1, 2, 3].map((n) => ({
      headline: `slide ${n}`,
      primaryLabel: "Shop",
      primaryHref: "/store",
      imageUrl: "",
    }));
    const afterDelete = before.slice(0, 2);

    // Autoplay (or a click on the third dot) left the index at 2.
    const index = 2;
    expect(before[activeSlideIndex(index, before.length)]).toBeDefined();

    const shown = afterDelete[activeSlideIndex(index, afterDelete.length)];
    expect(shown).toBeDefined();
    expect(shown.headline).toBe("slide 2");
  });

  it("holds the index steady while it is still in range", () => {
    expect(activeSlideIndex(0, 3)).toBe(0);
    expect(activeSlideIndex(1, 3)).toBe(1);
    expect(activeSlideIndex(2, 3)).toBe(2);
  });

  it("never returns an index the list cannot answer", () => {
    for (const count of [1, 2, 3, 8]) {
      for (const index of [0, 1, 5, 99]) {
        const resolved = activeSlideIndex(index, count);
        expect(resolved).toBeGreaterThanOrEqual(0);
        expect(resolved).toBeLessThan(count);
      }
    }
  });
});
