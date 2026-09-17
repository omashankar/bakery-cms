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

  /**
   * THE TILE'S OWN CLASS STRING, found by the one thing about it that is not
   * a style choice: its width. Three tests used to locate it by the literal
   * "rounded-2xl bg-cream-", and all three broke the day a class was inserted
   * between those two — for a tile that was still perfectly correct. A guard
   * that fails on class ORDER is testing the author's typing.
   */
  const tileClasses = () => {
    const found = strip().match(/"group flex w-\[5\.5rem\][^"]*"/);
    expect(found, "the category tile is gone").toBeTruthy();
    return found![0];
  };

  it("frame the picture in the card's own tint rather than being the picture", () => {
    /**
     * The image filled the card edge to edge, so a cut-out product photograph
     * — the kind with no background of its own — floated in a white void.
     * Inset, the tile reads as a tile.
     *
     * ALL THREE OF TINT, HAIRLINE AND LIFT, because the tile needs each for a
     * different reason and this went wrong twice by treating them as one.
     * First the tint was `from-cream-50 to-white` — and `--cream-50` is
     * #ffffff, so the gradient ran white to white and there was no tint at
     * all, only the hairline. Then the tint became real and the hairline was
     * dropped as redundant, leaving a grey-beige slab with no edge.
     *
     * They are not redundant. The tint gives a cut-out product something to
     * sit on, the hairline says where the tile stops against a white band,
     * and the shadow lifts it off one. This asks for all three.
     */
    const tile = tileClasses();
    expect(tile, "the picture is flush to the card edge").toMatch(/\bp-2\b/);
    expect(tile, "the tint is white, which is not a tint").not.toMatch(
      /bg-cream-50\b|from-cream-50\b/,
    );
    expect(tile, "the tile has no tint of its own").toMatch(/\bbg-cream-\d/);
    expect(tile, "the tile has no edge against a white band").toMatch(
      /\bborder-border/,
    );
    expect(tile, "the tile is a hole in the page, not a card on it").toMatch(
      /\bshadow-(xs|sm)\b/,
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
    const classString = tileClasses();

    expect(classString.length, "the card class string is unreadable").toBeGreaterThan(40);
    expect(classString).not.toContain("overflow-hidden");
  });
});
