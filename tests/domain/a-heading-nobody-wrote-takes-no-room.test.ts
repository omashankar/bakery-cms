import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { HOMEPAGE_SECTION_REGISTRY } from "@/constants/section-registry";

/**
 * A HEADING-SHAPED HOLE ABOVE THE BAND IT WAS INTRODUCING.
 *
 * `SectionHeader` rendered its `<h2>` unguarded, so a blank title drew an empty
 * heading at 36px with a 40px margin under it. Not a hypothetical and not new:
 * four section types ship `title: ""` deliberately, and every one of them has
 * been leaving that gap on every page it appears on — which is also why the
 * band under the hero sat so far down the page that it looked like a mistake.
 *
 * The rest of this file is the other half of the same band: the tiles under it.
 */
const read = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8")
    .split(String.fromCharCode(13, 10))
    .join(String.fromCharCode(10));
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

const HEADER = "components/shared/section-header.tsx";
const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";

describe("a section heading with nothing in it", () => {
  it("renders nothing at all, rather than an empty band", () => {
    const source = code(HEADER);

    expect(source).toMatch(
      /if \(!hasOverline && !hasTitle && !hasDescription\) return null;/,
    );
  });

  it("and the title is guarded like the two lines around it always were", () => {
    /**
     * The overline and the description were both `{x && (…)}` from the start.
     * Only the `<h2>` was unconditional, which is why the hole was heading-sized
     * rather than nothing at all.
     */
    const source = code(HEADER);
    const at = source.indexOf("<h2");
    expect(at, "the heading is gone").toBeGreaterThan(-1);

    expect(source.slice(at - 120, at)).toContain("hasTitle &&");
  });

  it("and a space is not a heading", () => {
    // A stored value that looks empty in the builder is the likeliest way to
    // end up with one, so the check is on the trimmed string.
    const source = code(HEADER);

    for (const name of ["overline", "title", "description"]) {
      expect(source, `${name} is checked without trimming`).toContain(`${name}?.trim()`);
    }
  });

  it("which is what four shipped section types were relying on", () => {
    /**
     * Named rather than counted: the point is that these are deliberate blanks,
     * chosen because a default title would be a claim about a band whose
     * contents the shop has not picked yet — so the fix above is what makes
     * that choice free rather than costly.
     */
    const blank = HOMEPAGE_SECTION_REGISTRY.filter(
      (entry) => entry.defaultContent.title === "",
    ).map((entry) => entry.type);

    expect(blank).toEqual(
      expect.arrayContaining(["tabbed-rail", "promo-collage", "tile-grid", "category-rail"]),
    );
  });
});

describe("the category tiles under the hero", () => {
  const strip = () => {
    const renderer = code(RENDERER);
    const at = renderer.indexOf("function OurMenuSection");
    const rest = renderer.slice(at + 1);
    const next = rest.search(/\n(?:export )?(?:function|const) /);
    return next < 0 ? rest : rest.slice(0, next);
  };

  it("frame the picture in the card's own tint rather than being the picture", () => {
    /**
     * The image filled the card edge to edge, so the tint and the border were a
     * hairline nobody could see and a cut-out product photograph — the kind
     * with no background of its own — floated in a white void. Inset, the tile
     * reads as a tile.
     */
    const body = strip();
    const card = body.indexOf("rounded-2xl border border-border");
    expect(card, "the card lost its border").toBeGreaterThan(-1);

    expect(body.slice(card, card + 300), "the picture is flush to the card edge").toMatch(
      /\bp-2\b/,
    );
  });

  it("and the picture keeps a corner radius inside that frame", () => {
    // Square corners inside a rounded card is the one combination that looks
    // like a mistake rather than a choice.
    const body = strip();
    const box = body.indexOf("relative aspect-square w-full");
    expect(box, "the image box is gone").toBeGreaterThan(-1);

    expect(body.slice(box, box + 200)).toContain("rounded-xl");
  });

  it("and the card no longer needs to clip what it contains", () => {
    /**
     * `overflow-hidden` was on the card because the image was flush to its
     * corners. With the image inset and rounded itself, the card clipping
     * anything would only be hiding a mistake.
     *
     * Scoped to the card's OWN class string, not a window past it: the image
     * box a few lines down legitimately clips, and a fixed-length window
     * reached it and failed on code that was correct.
     */
    const body = strip();
    const card = body.indexOf("rounded-2xl border border-border");
    const classString = body.slice(card, body.indexOf('"', card));

    expect(classString.length, "the card class string is unreadable").toBeGreaterThan(40);
    expect(classString).not.toContain("overflow-hidden");
  });
});
