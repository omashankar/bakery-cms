// A non-UTC zone, set before anything here touches Date — in UTC the banner
// schedule assertions pass against the broken implementation too.
process.env.TZ = "Asia/Kolkata";

import { describe, expect, it } from "vitest";

import { fromScheduleInputValue, toScheduleInputValue } from "@/lib/datetime-local";
import {
  bannerPositionOptions,
  selectActiveHeroBanners,
} from "@/features/content/lib/banners-utils";
import { selectStorefrontTestimonials } from "@/features/content/lib/storefront-content";
import { contentSchemas } from "@/features/content/server/content.validators";
import type { Banner } from "@/types/media";
import type { Testimonial } from "@/types/content";

const NOW = Date.parse("2026-08-10T06:00:00.000Z");

function banner(over: Partial<Banner> & { id: string }): Banner {
  return {
    title: over.id,
    image: "https://example.com/b.jpg",
    isActive: true,
    position: "hero",
    priority: 0,
    visibility: "all",
    createdAt: "",
    updatedAt: "",
    ...over,
  } as Banner;
}

function testimonial(over: Partial<Testimonial> & { id: string }): Testimonial {
  return {
    name: over.id,
    role: "",
    content: "",
    avatar: "",
    rating: 5,
    status: "published",
    isFeatured: false,
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
    ...over,
  } as Testimonial;
}

/**
 * A banner's schedule is a promise about when a campaign runs.
 *
 * The form wrote it correctly and read it back wrong: `banner.startDate.slice(0, 16)`
 * takes the first sixteen characters of a UTC instant and hands them to a
 * `datetime-local` input, which reads them as LOCAL wall time. A 09:00 IST start
 * displayed as 03:30, and the next save re-encoded that displayed value — so
 * fixing a typo in the title walked the campaign 5h30m earlier, every time. The
 * builders' scheduled publish had the identical bug; both use these helpers now.
 */
describe("a banner's schedule", () => {
  it("runs in a zone where the bug is observable", () => {
    expect(new Date("2026-08-10T03:30:00.000Z").getHours()).toBe(9);
  });

  it("survives being reopened and saved again", () => {
    const chosen = "2026-08-10T09:00";
    let stored = fromScheduleInputValue(chosen);
    expect(stored).toBe("2026-08-10T03:30:00.000Z");

    // Reopen, change something else, save. Five times.
    for (let i = 0; i < 5; i += 1) {
      expect(toScheduleInputValue(stored)).toBe(chosen);
      stored = fromScheduleInputValue(toScheduleInputValue(stored));
      expect(stored).toBe("2026-08-10T03:30:00.000Z");
    }
  });

  it("treats a banner with no dates as always in window", () => {
    expect(selectActiveHeroBanners([banner({ id: "a" })], "all", NOW)).toHaveLength(1);
  });
});

/**
 * Visibility is a choice the admin makes and the storefront has to honour.
 *
 * `"all"` is the WILDCARD in this selector — "apply no filter" — not the
 * visibility VALUE "all". The homepage passed the wildcard, so a banner scoped to
 * "Collections pages" rendered on the homepage; the strip in the layout shell
 * hardcoded "homepage", so a homepage-only banner appeared on every page and a
 * collections banner appeared on none.
 */
describe("banner visibility", () => {
  const set = [
    banner({ id: "everywhere", visibility: "all" }),
    banner({ id: "home-only", visibility: "homepage" }),
    banner({ id: "collections-only", visibility: "collections" }),
  ];

  it("shows a homepage-scoped banner on the homepage", () => {
    expect(selectActiveHeroBanners(set, "homepage", NOW).map((b) => b.id).sort()).toEqual([
      "everywhere",
      "home-only",
    ]);
  });

  it("keeps a homepage-scoped banner off the collections pages", () => {
    expect(selectActiveHeroBanners(set, "collections", NOW).map((b) => b.id).sort()).toEqual([
      "collections-only",
      "everywhere",
    ]);
  });

  it("shows only storewide banners on anything else", () => {
    expect(selectActiveHeroBanners(set, "all", NOW).map((b) => b.id)).toContain("everywhere");
  });

  it("renders no position other than the hero strip", () => {
    const others = selectActiveHeroBanners(
      [banner({ id: "side", position: "sidebar" }), banner({ id: "pop", position: "popup" })],
      "homepage",
      NOW,
    );

    expect(others).toEqual([]);
    // …and the admin is told so, rather than being shown an Active badge for a
    // banner that appears nowhere.
    const labels = Object.fromEntries(bannerPositionOptions.map((o) => [o.value, o.label]));
    expect(labels.sidebar).toMatch(/not shown/i);
    expect(labels.popup).toMatch(/not shown/i);
  });
});

/**
 * Both storefront testimonial sections drew five filled stars for every card,
 * with the testimonial's own rating sitting unread beside it — and `isFeatured`
 * was never looked at anywhere.
 */
describe("testimonials", () => {
  it("leads with the ones the admin featured", () => {
    const ordered = selectStorefrontTestimonials([
      testimonial({ id: "third", sortOrder: 3 }),
      testimonial({ id: "featured", sortOrder: 9, isFeatured: true }),
      testimonial({ id: "first", sortOrder: 1 }),
    ]);

    expect(ordered.map((item) => item.id)).toEqual(["featured", "first", "third"]);
  });

  it("keeps the admin's order among the rest", () => {
    const ordered = selectStorefrontTestimonials([
      testimonial({ id: "b", sortOrder: 2 }),
      testimonial({ id: "a", sortOrder: 1 }),
    ]);

    expect(ordered.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("never shows an unpublished one", () => {
    const ordered = selectStorefrontTestimonials([
      testimonial({ id: "draft", status: "draft", isFeatured: true }),
      testimonial({ id: "live" }),
    ]);

    expect(ordered.map((item) => item.id)).toEqual(["live"]);
  });

  it("carries the rating the customer actually gave", () => {
    const [item] = selectStorefrontTestimonials([testimonial({ id: "a", rating: 3 })]);

    expect(item.rating).toBe(3);
  });

  it("refuses to store a rating outside 0–5", () => {
    const schema = contentSchemas.testimonials;

    expect(schema.safeParse([{ id: "a", name: "A", rating: 40 }]).success).toBe(false);
    expect(schema.safeParse([{ id: "a", name: "A", rating: -1 }]).success).toBe(false);
    expect(schema.safeParse([{ id: "a", name: "A", rating: 3 }]).success).toBe(true);
  });
});
