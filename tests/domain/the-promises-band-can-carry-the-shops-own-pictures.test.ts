import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { HOMEPAGE_SECTION_REGISTRY } from "@/constants/section-registry";

/**
 * THE BAND OF PROMISES — a picture, a bold line, a quieter line, four across.
 *
 * IT IS NOT A NEW SECTION, and finding that out was most of the work. `why-us`
 * has drawn exactly this band all along: a list the shop fills in, an icon per
 * row, empty by default, nothing drawn when empty. It is on this shop's page
 * with four points the shop wrote itself. So it gained two things rather than
 * being written again:
 *
 *   a PICTURE per row, because the layout the shop held up uses small
 *   illustrations and no icon set will ever match a shop's own artwork;
 *
 *   a SHAPE, because the layout puts the four points inside one tinted panel
 *   with the picture beside the words, and this band drew four bordered cards
 *   with the icon above them.
 *
 * Both ship blank, so the band already published keeps what it had.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";

const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const entry = HOMEPAGE_SECTION_REGISTRY.find((s) => s.type === "why-us");

/** The band's own body, so no guard can be met by another section. */
function band(): string {
  const src = codeOf(read(RENDERER));
  const at = src.indexOf("function WhyUsSection(");
  expect(at, "WhyUsSection is gone").toBeGreaterThan(-1);
  const next = src.indexOf("\nfunction ", at + 10);
  return src.slice(at, next < 0 ? src.length : next);
}

const tileFields = () =>
  entry!.fields.find((f) => f.key === "items")?.itemFields ?? [];

describe("the promises band carries the shop's own pictures", () => {
  it("takes a picture per point, and says what size to export", () => {
    const picture = tileFields().find((f) => f.key === "image");

    expect(picture, "there is no way to upload a picture").toBeTruthy();
    expect(picture!.isImage, "the picture field is not a picture field").toBe(true);
    expect(picture!.hint ?? "", "nothing says what size to export").toContain("144 x 144");
  });

  it("and keeps the icon for a point that has no picture", () => {
    /*
      NOT A REPLACEMENT. A shop with nothing to upload still gets a finished
      row — which is what this band has always given. The icon list is the
      same four it has always offered.
    */
    const icon = tileFields().find((f) => f.key === "icon");

    expect(icon, "the icon has been dropped").toBeTruthy();
    expect(icon!.options?.map((o) => o.value)).toEqual(["Award", "Leaf", "Truck", "Palette"]);
    expect(band(), "the picture does not fall back to the icon").toContain(
      "picture ? (",
    );
  });

  it("and never drops a point for having no picture", () => {
    /*
      `photoRows` exists and keeps only rows that HAVE a picture. Used here it
      would silently delete every icon-only point — including all four on this
      shop's own page, none of which has an uploaded picture.
    */
    const body = band();

    expect(body, "the rows are filtered by picture").toContain(
      'renderableRows(parseListField(c, "items"))',
    );
    expect(body.includes("photoRows"), "icon-only points are being dropped").toBe(false);
  });

  it("offers two shapes, and ships the one it already had", () => {
    const shape = entry!.fields.find((f) => f.key === "layout");

    expect(shape, "there is no way to choose the shape").toBeTruthy();
    expect(shape!.options?.map((o) => o.value)).toEqual(["", "strip"]);
    expect(entry!.defaultContent.layout, "the new shape is now the default").toBe("");
  });

  it("and draws both of them", () => {
    /*
      A SETTING THE RENDERER NEVER READS is this repo's most-recorded defect:
      the editor draws the box, the value is stored, the page ignores it. So
      the read is pinned inside this band's own body, not anywhere in the file.
    */
    const body = band();

    expect(body, "the shape is never read").toContain(
      'contentString(c, "layout").trim() === "strip"',
    );
    // The strip is one tinted panel; the cards are four bordered boxes.
    expect(body, "the strip has no panel of its own").toContain("rounded-2xl bg-cream-100");
    expect(body, "the cards lost their border").toContain(
      '"rounded-xl border border-border bg-card p-5"',
    );
    // And the picture sits BESIDE the words in the strip, above them in cards.
    expect(body, "the strip does not lay its points sideways").toContain(
      '"flex items-center gap-3 sm:gap-4"',
    );
  });

  it("suggests no wording of its own, anywhere", () => {
    /*
      THE PLACEHOLDER WAS THE LEAK. This band's Title box suggested "Premium
      Ingredients" — food, and a claim — and three of the four labels that had
      to be cleaned off this page were typed straight out of a placeholder.

      The reference layout's own points are "Delivery in 700+ Cities" and
      "20 Million People Trust Us". Nothing in this CMS can make either true,
      and there is no field anywhere that could.
    */
    for (const field of [...tileFields(), ...entry!.fields]) {
      expect(field.placeholder ?? "", `${field.key} suggests wording`).toBe("");
    }
    for (const [key, value] of Object.entries(entry!.defaultContent)) {
      if (key === "title") continue; // the band's own name, not a claim
      expect(value, `${key} ships with words in it`).toBe("");
    }
  });
});
