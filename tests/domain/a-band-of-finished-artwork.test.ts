import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { HOMEPAGE_SECTION_REGISTRY } from "@/constants/section-registry";

/**
 * THE BANNER GRID.
 *
 * Every other band on the homepage draws words over or under a picture. This
 * one must not: the shop exports banners with their heading, strapline and
 * button already drawn into the artwork, so anything this file painted on top
 * would be a second heading over the first.
 *
 * That makes two things load-bearing, and neither is obvious from looking at
 * the band on a screen:
 *
 *  1. It renders NO card text. A title or button field would invite an admin
 *     to type one, and it would land on top of the artwork's own.
 *  2. The link's accessible name comes from a field, because a picture whose
 *     words are pixels says nothing at all to a screen reader.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";

const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

/** The section's own function body, so an assertion cannot match a sibling's. */
function body(): string {
  const src = codeOf(read(RENDERER));
  const at = src.indexOf("function BannerGridSection(");
  expect(at, "BannerGridSection is gone").toBeGreaterThan(-1);
  const rest = src.slice(at + 10);
  const next = rest.search(/\n(?:export )?function /);
  return next < 0 ? src.slice(at) : src.slice(at, at + 10 + next);
}

describe("the band of finished artwork", () => {
  const entry = HOMEPAGE_SECTION_REGISTRY.find((s) => s.type === "banner-grid");

  it("is in the registry, and ships with no banners", () => {
    expect(entry, "the banner grid is gone from the registry").toBeTruthy();
    expect(entry!.defaultContent.banners).toBe("[]");
    expect(entry!.defaultContent.title).toBe("");
  });

  it("offers no field that would write words over the artwork", () => {
    /**
     * A subtitle or button field here is a trap: an admin fills it in, and the
     * words land on top of the ones already in the picture. The band has a
     * heading of its OWN — that sits above the grid, not on a banner — and
     * nothing per-card but the picture, its link and its label.
     */
    const columns = entry!.fields.find((f) => f.key === "banners")?.itemFields ?? [];

    expect(columns.map((c) => c.key).sort()).toEqual(["href", "image", "label", "wide"]);
    for (const banned of ["subtitle", "ctaLabel", "description", "title"]) {
      expect(
        columns.some((c) => c.key === banned),
        `a card-level "${banned}" would be written over the artwork`,
      ).toBe(false);
    }
  });

  it("draws nothing at all when the shop has added no banners", () => {
    expect(body()).toContain("if (banners.length === 0) return null;");
  });

  it("renders the picture and the link, and no card text", () => {
    const section = body();

    // The only thing inside a card is the picture.
    expect(section, "the card draws text over the artwork").not.toMatch(
      /\{banner\.(title|subtitle|ctaLabel)\}/,
    );
    expect(section, "the label is drawn rather than announced").not.toMatch(
      />\s*\{banner\.label\}/,
    );
    expect(section, "the link has no accessible name").toContain('alt={banner.label ?? ""}');
  });

  it("spans five of fifteen columns for a wide banner and three for the rest", () => {
    /**
     * Fifteen is the only number that does what the layout asks: a row of
     * three wide banners over a row of five narrow ones, and 15 is the
     * smallest grid both divide into. A 4- or 5-column grid cannot hold a row
     * of three without leaving a hole.
     *
     * Verified in a browser at 1440px: three cards at 444px and five at 258px,
     * which is 5/15ths and 3/15ths of the column.
     */
    const section = body();

    expect(section).toContain("lg:grid-cols-15");
    expect(section).toContain("lg:col-span-5");
    expect(section).toContain("lg:col-span-3");
  });

  it("reads the wide flag through rowFlag, not as a string", () => {
    // A row's values are all strings by the time they reach here, so an
    // UNTICKED box arrives as "false" — which is truthy.
    expect(body()).toContain("rowFlag(banner.wide)");
  });

  it("gives each card a ratio, so a row lines up whatever was exported", () => {
    // Without one the tallest picture sets the row height and the rest sit in
    // a band of their own background.
    const section = body();

    expect(section).toMatch(/aspect-\[11\/10\]/);
    expect(section).toMatch(/aspect-\[2\/3\]/);
  });
});
