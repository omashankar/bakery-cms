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
];

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
    const homepage = stripComments(read(SURFACES[0]));
    const wedding = stripComments(read(SURFACES[1]));

    // Each gallery-ish section bails out when the shop has given it no photos.
    expect(homepage).toContain('renderableRows(parseListField(c, "images"))');
    expect(homepage).toContain('renderableRows(parseListField(c, "posts"))');
    expect(wedding).toContain('renderableRows(parseListField(c, "images"))');
    expect((homepage.match(/if \(\w+\.length === 0\) return null;/g) ?? []).length).toBeGreaterThan(
      1,
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
    // `isImage` is what turns a row's column into the Media picker; without the
    // editor honouring it, an admin would have to paste URLs by hand.
    const editor = read("apps/admin/builders/shared/section-editor-panel.tsx");
    expect(editor).toContain("column.isImage ? (");
    expect(editor).toMatch(/column\.isImage \? \(\s*<BuilderMediaField/);
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
