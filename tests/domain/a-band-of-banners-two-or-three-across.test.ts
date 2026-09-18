import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { HOMEPAGE_SECTION_REGISTRY } from "@/constants/section-registry";

/**
 * THE BAND THE SHOP FILLS WITH ITS OWN ARTWORK, TWO OR THREE ACROSS.
 *
 * It is not a new section. `banner-grid` already drew pictures with a link
 * round each and wrote nothing over them, which is exactly what artwork with
 * its words baked into it needs — and the other two-card band on this page,
 * `promo-collage`, draws a title, a line under it and a button ON TOP of the
 * picture, so it would have written over the words already there.
 *
 * What banner-grid could not do was an EVEN row. It had one shape: a fifteen-
 * column collage of wide cards beside narrow ones. So it gained a setting,
 * and that setting is what this file is about.
 *
 * The sizes themselves are measured in
 * tests/e2e/a-band-of-banners-two-or-three-across.spec.ts — nothing here can
 * see a window.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";

const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const entry = HOMEPAGE_SECTION_REGISTRY.find((s) => s.type === "banner-grid");

/** The body of the band, so a guard cannot be met by some other section. */
function band(): string {
  const src = codeOf(read(RENDERER));
  const at = src.indexOf("function BannerGridSection(");
  expect(at, "BannerGridSection is gone").toBeGreaterThan(-1);
  const next = src.indexOf("\nfunction ", at + 10);
  return src.slice(at, next < 0 ? src.length : next);
}

describe("a band of banners, two or three across", () => {
  it("is a setting on the band that already existed", () => {
    expect(entry, "the banner grid is gone from the registry").toBeTruthy();

    const field = entry!.fields.find((f) => f.key === "columns");
    expect(field, "there is no way to choose how many go across").toBeTruthy();
    expect(field!.options?.map((o) => o.value)).toEqual(["", "2", "3"]);
  });

  it("and ships blank, so every band already on a page keeps its shape", () => {
    /*
      THE ONE THING THAT COULD BREAK A LIVE PAGE. This band is published on
      this shop as a fifteen-column collage. A default of "2" would have
      rearranged it on the next render, with nothing in the diff about it.
    */
    expect(entry!.defaultContent.columns, "the even row is now the default").toBe("");
    expect(band(), "the collage shape is gone").toContain("lg:grid-cols-15");
  });

  it("states a picture size for each of the three shapes", () => {
    /*
      ONE FIELD FEEDS ALL THREE, so one hint has to cover all three. A shop
      that exports a 2-across banner and switches the band to 3 gets a
      different box, and nothing else on the screen would have said so.
    */
    const picture = entry!.fields
      .find((f) => f.key === "banners")
      ?.itemFields?.find((f) => f.isImage);

    expect(picture, "the picture field is gone").toBeTruthy();
    for (const size of ["750 x 290", "490 x 290", "1100 x 1000", "800 x 1200"]) {
      expect(
        picture!.hint ?? "",
        `the editor does not say what to export for ${size}`,
      ).toContain(size);
    }
  });

  it("says where the per-card Wide switch still applies", () => {
    // It is the collage's control. In an even row it is ignored, and a switch
    // that does nothing with no explanation is the shop filing a bug.
    const wide = entry!.fields
      .find((f) => f.key === "banners")
      ?.itemFields?.find((f) => f.key === "wide");

    expect(wide, "the wide switch is gone").toBeTruthy();
    expect(wide!.label.toLowerCase(), "the wide switch does not say when it counts")
      .toContain("mixed");
  });

  it("gives every card in an even row the same box", () => {
    /*
      THE WHOLE POINT OF THE EVEN ROW. Honouring the per-card `wide` flag here
      would make one card in three a different width and a different shape,
      which is the collage the shop chose NOT to have.
    */
    const body = band();
    const at = body.indexOf("const box = cn(");
    expect(at, "the card box is gone").toBeGreaterThan(-1);
    const box = body.slice(at, body.indexOf("          );", at));

    expect(box, "the even row does not take its own ratio").toContain("across");
    expect(
      box.indexOf("across") < box.indexOf("wide"),
      "the per-card wide flag is read before the band's own shape",
    ).toBe(true);
  });

  it("holds one ratio per shape rather than letting the artwork decide", () => {
    /*
      A row of banners exported at three different shapes is a row of three
      different heights with the shop's background showing through the gaps.
      The band states the box; the editor states what to export into it.
    */
    const src = codeOf(read(RENDERER));
    const at = src.indexOf("const BANNER_ROW = {");
    expect(at, "the shapes are gone").toBeGreaterThan(-1);
    const shapes = src.slice(at, src.indexOf("} as const;", at));

    expect(shapes, "the pair has no ratio").toContain("aspect-[750/290]");
    expect(shapes, "the trio has no ratio").toContain("aspect-[493/290]");
  });

  it("and never splits a row before the split makes a card bigger", () => {
    /*
      MEASURED, AND BOTH FIRST DRAFTS HAD IT WRONG. The pair split at `md`,
      and at 768 its two banners came out 350x135 — smaller than the single
      one a 390px phone gets, which is 358x138. The step was making the band
      worse at the width it was added for.

      The trio kept `md` for a real reason — one 1.7:1 banner across a
      1024px tablet is 976x574 and most of the screen — and lost to the
      same 350 against 358. Taste does not beat a measurement.
    */
    const src = codeOf(read(RENDERER));
    const at = src.indexOf("const BANNER_ROW = {");
    const shapes = src.slice(at, src.indexOf("} as const;", at));

    const pair = shapes.slice(shapes.indexOf('"2":'), shapes.indexOf('"3":'));
    const trio = shapes.slice(shapes.indexOf('"3":'));

    for (const [name, shape] of [["pair", pair], ["trio", trio]] as const) {
      expect(shape, `the ${name} splits on a tablet again`).not.toContain(
        "md:grid-cols-2",
      );
      expect(shape, `the ${name} never splits`).toContain("lg:grid-cols-2");
    }
    expect(trio, "the trio never reaches three").toContain("xl:grid-cols-3");

    // Both start stacked: three 493px banners on a 390px screen is 120px each,
    // and the words in these pictures are pixels.
    for (const shape of [pair, trio]) {
      expect(shape, "a shape does not start as one column").toContain("grid-cols-1");
    }
  });

  it("still writes nothing over the artwork", () => {
    /*
      THE RULE THE WHOLE SECTION EXISTS FOR, and the reason this is not
      `promo-collage`. A card here has a picture, a link and a label for a
      screen reader — no title, no subtitle, no button, because all three are
      already drawn into the picture.
    */
    const columns =
      entry!.fields.find((f) => f.key === "banners")?.itemFields?.map((f) => f.key) ?? [];

    expect(columns.sort()).toEqual(["href", "image", "label", "wide"]);
  });
});
