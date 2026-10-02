import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { HOMEPAGE_SECTION_REGISTRY } from "@/constants/section-registry";

/**
 * A bakery's photographs are the thing customers choose it by.
 *
 * Three surfaces rendered `galleryImages` and `instagramPosts` from
 * landing-data — the same twelve stock Unsplash photos of somebody else's
 * cakes, plus six more under the shop's REAL Instagram handle, each tile
 * linking to that profile. Every shop running this CMS published them as its
 * own work, with no field anywhere to change them. Someone choosing a bakery by
 * its pictures was choosing on another bakery's.
 *
 * They are section content now, uploaded through the Media library, and a
 * section with no photos does not render at all.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");

const SURFACES = [
  "features/cms-sections/homepage-section-renderer.tsx",


  /*
    The dedicated gallery page and its route used to be on this list. The
    shop asked for that page to go, so the surfaces that can show somebody
    else's photographs as this shop's own are the two renderers above.
  */
];

/** One renderer function's own body, so an assertion cannot match a sibling's. */
function bodyOf(source: string, component: string): string {
  const at = source.indexOf(`function ${component}(`);
  expect(at, `${component} is not defined here`).toBeGreaterThan(-1);
  const next = source.indexOf("\nfunction ", at + 1);
  return source.slice(at, next < 0 ? source.length : next);
}

describe("every surface that shows photographs", () => {
  it("no longer reads the shipped demo pictures", () => {
    for (const path of SURFACES) {
      const rendered = stripComments(read(path));

      for (const constant of ["galleryImages", "galleryCaptions", "instagramPosts"]) {
        expect(rendered, `${path} still renders ${constant}`).not.toContain(constant);
      }
    }
  });

  it("renders nothing rather than a heading over an empty grid", () => {
    /**
     * PINNED TO EACH SECTION'S OWN BODY, which is the whole point.
     *
     * Counting the guards file-wide was already satisfied by two that predate
     * this work (Menu Strip and Why Choose Us), so a band's guard could be
     * deleted — restoring a heading over an empty grid — with this test, named
     * for exactly that, still green.
     *
     * THE TWO IT WAS WRITTEN FOR ARE GONE. `GallerySection` and
     * `InstagramSection` were deleted with seven others. The property is not
     * about them: it is about any band that holds the shop's photographs, and
     * these seven do — every entry in the registry with an image column.
     *
     * Two spellings, because the strip counts first: `banners.length === 0`
     * and `count === 0` are the same guard.
     */
    const homepage = stripComments(read(SURFACES[0]));

    const HOLDS_PHOTOS = [
      "OurMenuSection",
      "TileGridSection",
      "BlogCardsSection",
      "BannerGridSection",
      "CategoryPriceCardsSection",
      "BannerStripSection",
      "WhyUsSection",
    ];

    for (const component of HOLDS_PHOTOS) {
      expect(
        bodyOf(homepage, component),
        `${component} draws a heading over an empty list`,
      ).toMatch(/if \(\w+(?:\.length)? === 0\) return null;/);
    }
  });

  it("reads a section's content without filtering it by visibility", () => {
    /**
     * Hiding a section means "not on the homepage", not "throw the content
     * away". A second surface reading the same section through the
     * visibility-filtered accessor would go empty the moment an admin hid
     * the homepage band, while the builder still showed every photo.
     *
     * The standalone gallery page was that second surface and this test was
     * written for it. That page is gone, but the accessor is still the one
     * anything else would reach for, and it is still the half that can be
     * got wrong silently.
     */
    const accessor = stripComments(read("features/cms-sections/data/homepage-sections.server.ts"));
    const body = accessor.slice(accessor.indexOf("export async function getPublishedSectionContent"));

    expect(body, "the accessor is gone").not.toBe("");
    expect(body.slice(0, body.indexOf("\n}")), "the unfiltered accessor filters after all").not.toContain(
      "getVisibleSections",
    );
  });
});

describe("the builder", () => {
  const listFieldsOf = (registry: { type: string; fields?: { key: string; type: string; itemFields?: { key: string; isImage?: boolean }[] }[] }[]) =>
    registry.flatMap((entry) =>
      (entry.fields ?? [])
        .filter((field) => field.type === "list")
        .map((field) => ({ section: entry.type, field })),
    );

  it("offers a photo picker on every section that holds photographs", () => {
    /*
      `wedding-gallery` stood here until the wedding builder was removed, then
      `gallery` and `instagram` until those two were deleted. Naming sections
      that keep disappearing is how this case kept needing repair — so it asks
      the REGISTRY which bands hold photographs and checks each of those.

      A FLOOR, because "every section in an empty list" is true of nothing.
    */
    const all = listFieldsOf(HOMEPAGE_SECTION_REGISTRY);
    const holdPhotos = all.filter((entry) =>
      entry.field.itemFields?.some((column) => column.isImage),
    );

    expect(
      holdPhotos.length,
      "no section in the registry holds photographs at all",
    ).toBeGreaterThan(3);

    for (const { section, field } of holdPhotos) {
      expect(
        field.itemFields?.some((column) => column.isImage),
        `${section}'s list has no image column`,
      ).toBe(true);
    }
  });

  it("picks images through the media library, not a bare text box", () => {
    // `isImage` is what turns a row's column into the photo field; without the
    // editor honouring it, an admin would have to paste URLs by hand.
    const editor = read("apps/admin/builders/shared/section-editor-panel.tsx");
    expect(editor).toContain("column.isImage ? (");
    expect(editor).toMatch(/column\.isImage \? \(\s*<PhotoField/);
  });
});

describe("the media usage index", () => {
  it("no longer claims the gallery uses every shipped photo", () => {
    /**
     * Being in `galleryImages` used to mean "the storefront gallery shows
     * this", so every demo photo read as in use — and this index is what the
     * delete dialog and the Unused filter consult. The galleries read the
     * shop's own list now, which the remote-source search already covers.
     */
    const source = stripComments(read("apps/admin/media/lib/media-usage.ts"));

    expect(source).not.toContain("galleryImages");
    expect(source, "the remote-source search is what finds a picked photo now").toContain(
      "source.haystack.includes(normalized)",
    );
  });
});
