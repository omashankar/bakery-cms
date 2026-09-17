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

  /*
    THE TILE TURNED INSIDE OUT, and these three turned with it.

    They used to guard an INSET picture: padding on the card, a radius on the
    image box, and no clipping on the card because nothing reached its
    corners. Each of those was a real promise at the time and each is now the
    opposite of one — the shop looked at three bands at once and asked for the
    picture to fill the card the way an ecommerce card does.

    Rewritten rather than deleted, because the tile still has to be a tile:
    the tint, the hairline and the lift all stay, the corners still have to
    be clipped by SOMETHING, and the name still needs room it no longer
    inherits from the card.
  */
  it("fills the card with the picture, and keeps the tint behind it", () => {
    /**
     * ALL THREE OF TINT, HAIRLINE AND LIFT, because the tile needs each for a
     * different reason and this went wrong twice by treating them as one.
     * First the tint was `from-cream-50 to-white` — and `--cream-50` is
     * #ffffff, so the gradient ran white to white and there was no tint at
     * all, only the hairline. Then the tint became real and the hairline was
     * dropped as redundant, leaving a grey-beige slab with no edge.
     *
     * They are not redundant. The tint is what shows through a picture with
     * no background of its own and what fills the card while one loads, the
     * hairline says where the tile stops against a white band, and the shadow
     * lifts it off one.
     */
    const tile = tileClasses();

    expect(tile, "the picture is inset from the card edge again").not.toMatch(
      /(?:^|\s)(?:sm:|md:|lg:)?p-\d/,
    );
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

  it("clips at the card's own corners, so the picture reaches them", () => {
    /*
      With no padding the picture runs to the card's edge, so SOMETHING has to
      round it off — and it has to be the card, because the card is what has
      the corner. Without this the square paints over a rounded card and
      squares it off at the top.
    */
    const tile = tileClasses();

    expect(tile, "the picture will square off the card's corners").toContain(
      "overflow-hidden",
    );
    expect(tile, "the card has no corner to clip to").toMatch(/\brounded-/);
  });

  it("and the picture carries no second radius inside that one", () => {
    /*
      The image box had `rounded-xl` because it was inset and had to round
      itself. Now the card clips, and a rounded square floating inside a
      rounder one is the one combination that reads as a mistake.
    */
    const body = strip();
    const box = body.indexOf("relative aspect-square w-full");
    expect(box, "the image box is gone").toBeGreaterThan(-1);

    const boxClasses = body.slice(box, body.indexOf('"', box));
    expect(boxClasses, "two radii, one inside the other").not.toMatch(/\brounded-/);
  });

  it("gives the name its own room, because the card has none to lend", () => {
    /*
      The name read `px-1 pt-2.5 pb-1` and leaned on the card's 8/12px for the
      rest of its margin. With the card's padding gone it would have touched
      three edges — and this is the kind of thing that looks like a rendering
      fault rather than a style choice.
    */
    const body = strip();
    /*
      Matched as the ELEMENT, not by looking backwards from the text. The
      first {category.name} in this body is the image's ALT attribute, not
      the caption — a window before it found the image box every time, and
      the assertion then failed on a tile that was perfectly correct.
    */
    const name = body.match(
      /<p className="([^"]+)">\s*\{category\.name\}/,
    );
    expect(name, "the category name is no longer its own line").toBeTruthy();

    const classes = name![1];

    expect(classes, "the name has no side padding").toMatch(/\bpx-\d/);
    expect(classes, "the name has no room above it").toMatch(/\bpt-\d/);
    expect(classes, "the name sits on the card's bottom edge").toMatch(/\bpb-\d/);
  });
});
