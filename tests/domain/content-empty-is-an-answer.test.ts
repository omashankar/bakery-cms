import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadBanners } from "@/features/content/lib/banners-repository";
import { loadTestimonials } from "@/features/content/lib/testimonials-repository";
import { loadFaqs } from "@/features/content/lib/faq-repository";
import { loadMediaFiles } from "@/apps/admin/media/lib/media-repository";

/**
 * "Empty" cannot mean "never set up".
 *
 * Each of these browser caches re-seeded itself whenever the stored array was
 * empty, so an admin who deleted every banner, testimonial or FAQ saw the shipped
 * demo rows again on the next reload. The comment in two of them argued that
 * writing the re-seed LOCALLY made it harmless. It did not: the admin page reads
 * this list into its state, and every mutation here is a replace-all that sends
 * the whole list — so the demo rows came back on screen and the admin's next save
 * pushed them to the server and back onto the storefront.
 *
 * The same bug this repo has already been fixed for in delivery zones, coupons,
 * inquiries, reviews, products and — found in this same pass — the CMS pages
 * store. Only a missing or unreadable value may seed.
 */

const CASES = [
  { what: "banners", key: "bakery-cms-banners", load: loadBanners },
  { what: "testimonials", key: "bakery-cms-testimonials", load: loadTestimonials },
  { what: "faq", key: "bakery-cms-faq", load: loadFaqs },
  { what: "media library", key: "bakery-cms-media-library", load: loadMediaFiles },
] as const;

describe.each(CASES)("$what cache", ({ key, load }) => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("seeds a browser that has never seen this shop", () => {
    expect(load().length).toBeGreaterThan(0);
  });

  it("leaves a deliberately emptied list empty", () => {
    // The admin deleted every row; the server holds [] and hydration wrote it here.
    localStorage.setItem(key, "[]");

    expect(load()).toEqual([]);
  });

  it("keeps it empty across repeated reads", () => {
    // A reload, then another. The old code re-seeded on every one of them.
    localStorage.setItem(key, "[]");

    expect(load()).toEqual([]);
    expect(load()).toEqual([]);
    expect(load()).toEqual([]);
  });

  it("does not write the seed back over an empty list", () => {
    localStorage.setItem(key, "[]");

    load();

    expect(JSON.parse(localStorage.getItem(key) ?? "null")).toEqual([]);
  });

  it("still seeds when the stored value is unreadable", () => {
    localStorage.setItem(key, "{ not json");

    expect(load().length).toBeGreaterThan(0);
  });

  it("still seeds when the stored value is not an array", () => {
    localStorage.setItem(key, JSON.stringify({ oops: true }));

    expect(load().length).toBeGreaterThan(0);
  });

  it("returns what the shop actually has", () => {
    const stored = load();
    expect(stored.length).toBeGreaterThan(1);

    // Keep one row, as an admin who deleted the rest would.
    localStorage.setItem(key, JSON.stringify([stored[0]]));

    const after = load();
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe(stored[0].id);
  });
});
