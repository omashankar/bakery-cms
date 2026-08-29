import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { HOMEPAGE_SECTION_REGISTRY } from "@/constants/section-registry";
import { WEDDING_SECTION_REGISTRY } from "@/constants/wedding-section-registry";

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
  "features/cms-sections/wedding-section-renderer.tsx",
  "apps/website/landing/components/landing-gallery.tsx",
  // The dedicated gallery page and the route that feeds it. Both were missing
  // here, and `GalleryPage` declares `photos` as an optional prop defaulting to
  // `[]` — so dropping the wiring at the call site type-checks and degrades to
  // "Photographs of our work are on their way." with nothing red anywhere.
  "app/(storefront)/store/gallery/page.tsx",
  "apps/website/pages/gallery-page.tsx",
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

  it("renders nothing rather than someone else's work", () => {
    /**
     * Pinned to each SECTION's own body.
     *
     * Counting the guards file-wide was already satisfied by two that predate
     * this work (Menu Strip and Why Choose Us), so both gallery guards could be
     * deleted — restoring a heading over an empty grid — with this test, named
     * for exactly that, still green.
     */
    const homepage = stripComments(read(SURFACES[0]));
    const wedding = stripComments(read(SURFACES[1]));

    const sections = [
      { body: bodyOf(homepage, "GallerySection"), key: "images", where: "the homepage gallery" },
      { body: bodyOf(homepage, "InstagramSection"), key: "posts", where: "the Instagram strip" },
      { body: bodyOf(wedding, "WeddingGallerySection"), key: "images", where: "the wedding gallery" },
    ];

    for (const { body, key, where } of sections) {
      expect(body, `${where} no longer reads the shop's own "${key}"`).toContain(
        `photoRows(c, "${key}")`,
      );
      expect(body, `${where} renders a heading over an empty grid`).toMatch(
        /if \(\w+\.length === 0\) return null;/,
      );
    }
  });

  it("does not let the homepage strip govern the standalone gallery page", () => {
    /**
     * Hiding a section means "not on the homepage", not "throw the content
     * away". /store/gallery is a nav item of its own that sources its photos
     * from the Gallery section because there is no second place to upload them
     * — read through the visibility-filtered accessor, an admin who hid the
     * homepage strip emptied a different page while the builder still showed
     * every photo.
     */
    const route = stripComments(read("app/(storefront)/store/gallery/page.tsx"));

    expect(route, "the standalone page reads the visibility-filtered list").not.toContain(
      "getPublishedHomepageSections",
    );
    expect(route).toContain('getPublishedSectionContent("gallery")');
    expect(route, "the photos never reach the page").toMatch(/photos=\{photos\}/);

    const accessor = stripComments(read("features/cms-sections/data/homepage-sections.server.ts"));
    const body = accessor.slice(accessor.indexOf("export async function getPublishedSectionContent"));
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

  it("offers a photo picker on every gallery section", () => {
    const all = [...listFieldsOf(HOMEPAGE_SECTION_REGISTRY), ...listFieldsOf(WEDDING_SECTION_REGISTRY)];

    for (const section of ["gallery", "instagram", "wedding-gallery"]) {
      const match = all.find((entry) => entry.section === section);
      expect(match, `${section} has no list field to upload photos into`).toBeTruthy();
      expect(
        match!.field.itemFields?.some((column) => column.isImage),
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
