import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearRemoteUsageIndex,
  countMediaUsage,
  getMediaUsageDetails,
  isUsageIndexReady,
  setRemoteUsageIndex,
} from "@/apps/admin/media/lib/media-usage";

/**
 * "Unused" decides what an admin deletes, and a delete destroys the Cloudinary
 * asset rather than delisting it.
 *
 * The check used to look for builder references in four localStorage keys —
 * bakery-cms-homepage-draft, -published and the wedding pair. Those keys do not
 * exist: the page builders moved to MongoDB and the browser stores that owned
 * them were deleted. So every builder scan matched nothing, and CMS pages,
 * testimonial avatars, the header logo, the footer and the SEO images were never
 * looked at at all.
 *
 * The failure was concrete: an admin picks a hero image in the Homepage Builder,
 * publishes, opens the Media Library, and the detail panel for that exact file
 * says it is not referenced anywhere, the Unused card counts it, the Unused
 * filter selects it, and the delete goes through — while the live homepage still
 * points at it.
 */

vi.mock("@/features/products/lib/product-catalog", () => ({ getAllProducts: () => [] }));
vi.mock("@/features/products/lib/products-repository", () => ({ loadProducts: () => [] }));
vi.mock("@/features/content/lib/banners-repository", () => ({ loadBanners: () => [] }));

const HERO = "https://images.example.com/hero-diwali.jpg";

describe("where a media file is used", () => {
  beforeEach(() => {
    clearRemoteUsageIndex();
  });

  it("does not claim to know before it has looked", () => {
    expect(isUsageIndexReady()).toBe(false);
  });

  it("knows once the server documents are in", () => {
    setRemoteUsageIndex([]);

    expect(isUsageIndexReady()).toBe(true);
  });

  it("finds an image the homepage builder is using", () => {
    setRemoteUsageIndex([
      {
        label: "Homepage layout",
        context: "Builder",
        haystack: JSON.stringify({ state: { published: { sections: [{ content: { imageUrl: HERO } }] } } }),
      },
    ]);

    const refs = getMediaUsageDetails(HERO);

    expect(refs).toHaveLength(1);
    expect(refs[0]).toEqual({ label: "Homepage layout", context: "Builder" });
    expect(countMediaUsage(HERO)).toBe(1);
  });

  it.each([
    ["a CMS page body", "CMS pages", "Pages"],
    ["a testimonial avatar", "Testimonials", "Content"],
    ["the header logo", "Header", "Site layout"],
    ["the footer", "Footer", "Site layout"],
    ["an og:image", "SEO", "Site layout"],
    ["the wedding page layout", "Wedding page layout", "Builder"],
  ])("finds an image used by %s", (_what, label, context) => {
    setRemoteUsageIndex([
      { label, context, haystack: JSON.stringify({ anything: { nested: HERO } }) },
    ]);

    expect(getMediaUsageDetails(HERO)).toEqual([{ label, context }]);
  });

  it("reports every place at once", () => {
    setRemoteUsageIndex([
      { label: "Homepage layout", context: "Builder", haystack: HERO },
      { label: "CMS pages", context: "Pages", haystack: HERO },
      { label: "Footer", context: "Site layout", haystack: "something else" },
    ]);

    expect(countMediaUsage(HERO)).toBe(2);
  });

  it("says nothing uses a file that nothing uses", () => {
    setRemoteUsageIndex([
      { label: "Homepage layout", context: "Builder", haystack: JSON.stringify({ a: 1 }) },
    ]);

    expect(getMediaUsageDetails(HERO)).toEqual([]);
  });

  it("does not confuse a file with a longer URL that merely starts the same", () => {
    setRemoteUsageIndex([
      {
        label: "Homepage layout",
        context: "Builder",
        haystack: "https://images.example.com/hero-diwali-2.jpg",
      },
    ]);

    expect(countMediaUsage(HERO)).toBe(0);
  });

  it("errs towards 'in use' when one URL contains another", () => {
    // The known limit of a text search: a page holding ".../my-hero-diwali.jpg"
    // makes ".../hero-diwali.jpg" look referenced. That is the safe direction —
    // this answer gates a delete that destroys the asset, so an extra warning
    // costs a click and a missed reference costs a broken live page.
    setRemoteUsageIndex([
      {
        label: "CMS pages",
        context: "Pages",
        haystack: "https://images.example.com/my-hero-diwali.jpg",
      },
    ]);

    expect(countMediaUsage(HERO)).toBe(0);
    expect(countMediaUsage("hero-diwali.jpg")).toBe(1);
  });

  it("ignores an empty url rather than matching everything", () => {
    setRemoteUsageIndex([
      { label: "Homepage layout", context: "Builder", haystack: "{}" },
    ]);

    expect(getMediaUsageDetails("")).toEqual([]);
    expect(getMediaUsageDetails("   ")).toEqual([]);
  });
});
