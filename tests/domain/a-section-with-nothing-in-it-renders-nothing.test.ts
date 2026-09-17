import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

/** Comments quoting old code are not the code. */
const code = (path: string) =>
  source(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

/**
 * A heading with nothing under it reads as broken, not as unfinished.
 *
 * Every builder section that renders a LIST can be emptied — by an admin
 * clearing it, or by the rows it reads being drafted elsewhere. Most of these
 * renderers already bail on an empty list. The ones that did not were, between
 * them, the two most likely to actually BE empty: testimonials are what a shop
 * drafts first (the shipped ones are not its own), and FAQs are what a shop
 * that has not written any has none of.
 *
 * Drafting all three testimonials left "What Our Customers Say" over an empty
 * grid on the homepage and "What Couples Say" over an empty grid on the wedding
 * page — a full-height band, with a title, containing nothing.
 *
 * The check is by SECTION, and each is sliced to its own function, so a guard
 * added to one cannot satisfy the assertion for another.
 */
const RENDERERS = [
  {
    file: "features/cms-sections/homepage-section-renderer.tsx",
    sections: ["TestimonialsSection", "WhyUsSection", "GallerySection", "OffersSection"],
  },

];

/** One section's function body, bounded by the next declaration. */
function sectionBody(file: string, name: string): string {
  const src = code(file);
  const at = src.indexOf(`function ${name}(`);
  expect(at, `${name} not found in ${file}`).toBeGreaterThan(-1);
  const rest = src.slice(at + 10);
  const next = rest.search(/\nfunction |\nexport /);
  return src.slice(at, next > 0 ? at + 10 + next : src.length);
}

describe("a section with nothing in it", () => {
  for (const { file, sections } of RENDERERS) {
    for (const name of sections) {
      it(`${name} renders nothing rather than a heading over an empty list`, () => {
        const body = sectionBody(file, name);

        // It must decide on emptiness BEFORE it returns any markup — a guard
        // after the `return (` is not a guard.
        const beforeMarkup = body.slice(0, body.indexOf("return ("));
        expect(beforeMarkup, `${name} has no return`).not.toBe("");
        expect(
          beforeMarkup,
          `${name} renders its heading before checking whether it has any rows`,
        ).toMatch(/(length === 0|!\w+\.length|length\s*<\s*1)[\s\S]{0,40}return null/);
      });
    }
  }
});

/**
 * The Background dropdown has to be the thing that decides the background.
 *
 * `SectionShell` computes `bgClass` from `section.background` and then spreads
 * the caller's `className` AFTER it, so any `bg-*` or `surface-*` a section
 * passes there outranks the setting. Three sections did. The Wedding Collection
 * section read "White" in the builder while rendering cream — on the live page
 * AND in the preview beside the dropdown — and changing the dropdown did
 * nothing at all, on any of the three.
 *
 * A section may still override its PADDING. It may not override its background.
 */
describe("a section's Background setting", () => {
  for (const file of ["features/cms-sections/homepage-section-renderer.tsx"]) {
    it(`${file.split("/").pop()} lets the setting decide, not the section`, () => {
      const src = code(file);

      // Every <SectionShell …> opening tag, with its attributes.
      const tags = src.match(/<SectionShell[^>]*>/g) ?? [];
      expect(tags.length, "no SectionShell usages found — did it move?").toBeGreaterThan(3);

      const offenders = tags.filter((tag) => /className="[^"]*(?:\bbg-|\bsurface-)/.test(tag));
      expect(
        offenders,
        `these sections hardcode a background, so their dropdown does nothing:\n${offenders.join("\n")}`,
      ).toEqual([]);
    });
  }

  it("computes the background from the stored setting", () => {
    /*
      Matched as a SHAPE, not as one line of source — and twice now the shape
      was drawn too tightly. First it pinned the whitespace, so wrapping the
      expression across two lines failed a test about where the value comes
      from. Then it pinned the untinted branch as the literal "bg-white",
      and failed the day that branch became a TOKEN — which is strictly more
      of what this test is named for, not less.

      What matters is the two halves: the class is chosen by reading
      `section.background`, and neither branch is a raw colour a dropdown
      cannot reach.
    */
    for (const file of ["features/cms-sections/homepage-section-renderer.tsx"]) {
      const src = code(file);

      const chosen = src.match(
        /const bgClass =\s*section\.background === "cream"\s*\?\s*("[^"]+")\s*:\s*("[^"]+")/,
      );
      expect(chosen, `${file}: the band no longer reads section.background`).toBeTruthy();

      for (const branch of chosen!.slice(1)) {
        expect(
          branch,
          `${file}: ${branch} is a fixed colour, so the Appearance screen cannot reach it`,
        ).not.toMatch(/"(?:bg-)?(?:white|black)"|#/);
      }
    }
  });

  it("and the homepage draws a card rather than a stripe when asked for one", () => {
    /**
     * The third background is not a ground: `panel` leaves the band white and
     * tints a rounded box inside the page's column, which is the shape the
     * reference gives the rows it wants lifted out of the page.
     *
     * `fullBleed` has to win. The hero is the only caller, and a band that has
     * asked to run to both edges of the window cannot also be inset from them
     * — a panel there would put a frame round the picture.
     */
    const body = code("features/cms-sections/homepage-section-renderer.tsx");

    /*
      `startsWith`, because there are five panel values now: the neutral one
      and four tones. An `=== "panel"` here would draw every toned band as a
      full-width stripe instead of a card.
    */
    expect(body, "the panel background is gone").toContain(
      'const panel = section.background.startsWith("panel") && !fullBleed;',
    );
    expect(body, "the panel is not drawn as an inset card").toMatch(
      /rounded-2xl px-4 py-6[^"]*", panelTone/,
    );
  });

  it("and every tone the setting offers has a colour behind it", () => {
    /**
     * The tone map, the type and the validator are three lists that have to
     * agree. A tone in the dropdown with no entry in the map falls back to the
     * neutral tint — a setting that saves, reads back correctly in the builder,
     * and draws the wrong colour. A tone in the map that the validator rejects
     * is worse: the save is refused with no clue why.
     */
    const body = code("features/cms-sections/homepage-section-renderer.tsx");
    const types = code("types/homepage-builder.ts");
    const payload = code("features/cms-sections/lib/section-payload.ts");

    const declared = [...types.matchAll(/"(panel-[a-z]+)"/g)].map((m) => m[1]).sort();
    expect(declared.length, "no tones are declared any more").toBeGreaterThan(0);

    const mapped = [...body.matchAll(/"(panel-[a-z]+)": "bg-band-[a-z]+"/g)].map((m) => m[1]).sort();
    expect(mapped, "a tone the type offers has no colour in the renderer").toEqual(declared);

    for (const tone of declared) {
      expect(payload, `${tone} is not accepted by the payload validator`).toContain(`"${tone}"`);
    }

    // And the fallback, so an unknown value is a tint rather than no class.
    expect(body).toContain('PANEL_TONES[section.background] ?? "bg-cream-200"');
  });
});
