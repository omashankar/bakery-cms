import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { HOMEPAGE_SECTION_REGISTRY } from "@/constants/section-registry";

/**
 * THE GRID OF LABELLED PICTURE TILES, AS CARDS.
 *
 * NOT A NEW SECTION. `tile-grid` has drawn this band all along — a list of
 * pictures with a label and a link, the shop's own, empty by default — and it
 * was already on this shop's page with eleven tiles in it, near the foot. The
 * shop asked for it under the promises band and in the shape of the layout it
 * held up, so it moved and it gained a shape.
 *
 * PLAIN is what it has always drawn: a square picture with the label loose
 * under it on the page's own background. CARD is the layout being copied: a
 * bordered box, the picture across the top at 4:3, and the label in a tinted
 * bar along the foot of it. Blank is plain, so every grid already published
 * keeps what it had.
 *
 * The sizes are measured in tests/e2e/a-grid-of-picture-tiles-can-be-cards.spec.ts.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";

const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const entry = HOMEPAGE_SECTION_REGISTRY.find((s) => s.type === "tile-grid");

function band(): string {
  const src = codeOf(read(RENDERER));
  const at = src.indexOf("function TileGridSection(");
  expect(at, "TileGridSection is gone").toBeGreaterThan(-1);
  const next = src.indexOf("\nfunction ", at + 10);
  return src.slice(at, next < 0 ? src.length : next);
}

describe("a grid of picture tiles can be cards", () => {
  it("offers the two shapes, and ships the one it already drew", () => {
    const shape = entry!.fields.find((f) => f.key === "shape");

    expect(shape, "there is no way to choose the tile's shape").toBeTruthy();
    expect(shape!.options?.map((o) => o.value)).toEqual(["", "card"]);
    expect(entry!.defaultContent.shape, "the card is now the default").toBe("");
  });

  it("and says what size to export for each of them", () => {
    /*
      ONE PICTURE BOX FEEDS BOTH SHAPES and they are not the same ratio: plain
      is square and the card is 4:3. A shop that exports for one and switches
      to the other gets a crop, and nothing else on the screen would say so.
    */
    const picture = entry!.fields
      .find((f) => f.key === "tiles")
      ?.itemFields?.find((f) => f.isImage);

    expect(picture, "the picture field is gone").toBeTruthy();
    for (const size of ["600 x 600", "600 x 450"]) {
      expect(picture!.hint ?? "", `the editor does not name ${size}`).toContain(size);
    }
  });

  it("and draws both of them", () => {
    /*
      A SETTING THE RENDERER NEVER READS is this repo's most-recorded defect.
      Pinned inside this band's own body rather than anywhere in the file.
    */
    const body = band();

    expect(body, "the shape is never read").toContain(
      'contentString(c, "shape").trim() === "card"',
    );
    expect(body, "the card has no picture ratio of its own").toContain("aspect-[4/3]");
    expect(body, "the plain tile lost its square").toContain("aspect-square");
    expect(body, "the label has no bar to sit in").toContain("bg-cream-100");
  });

  it("and rounds the picture only where the card does not", () => {
    /*
      THE PICTURE IS THE TOP HALF OF ONE CARD. Rounding its foot cuts a notch
      out of the tinted bar underneath it, which is the kind of thing that
      looks like a rendering fault rather than a class.
    */
    const body = band();

    expect(body, "the card's picture is rounded all round").toContain("rounded-t-xl");
    expect(body, "the card itself has no clip").toContain(
      'card && "block overflow-hidden rounded-xl border border-border bg-card"',
    );
  });

  it("and the card is the whole tile, linked or not", () => {
    /*
      A tile the shop gave no link to is still a tile. Putting the border on
      the <Link> alone would leave those ones bare, which is a row of cards
      with a hole in it.
    */
    const body = band();
    const at = body.indexOf("const shell = cn(");
    expect(at, "the tile's own box is gone").toBeGreaterThan(-1);

    const after = body.slice(at);
    expect(after, "a linked tile is not the card").toContain("className={shell}");
    expect(
      after.split("className={shell}").length - 1,
      "the unlinked tile is not the card",
    ).toBe(2);
  });
});
