import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * THE VIEW-ALL PILL TAKES THE BAND'S OWN COLOUR.
 *
 * Measured off the layout this storefront follows: its pink band carries a
 * pink button, its cream band a yellow one, its two blue bands blue ones.
 * The rule holds in all four, and a neutral pill on a tinted band is the one
 * thing none of them does — on a tinted ground the pale grey it wore reads as
 * a disabled control rather than as the way in.
 *
 * A white or cream band keeps that grey, which is what the same layout does
 * over its own untinted rows.
 */
const N = String.fromCharCode(10);
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";
const CSS = "app/globals.css";

describe("the way in, on a tinted band", () => {
  it("has a stronger step of every tone the band offers", () => {
    /*
      A tone in the band map with no strong step beside it falls through to
      the neutral grey — which renders, and looks like the pill was forgotten
      on that one band only.
    */
    const renderer = codeOf(read(RENDERER));
    const bands = [...renderer.matchAll(/"(panel-[a-z]+)": "bg-band-([a-z]+)"/g)];

    expect(bands.length, "the band tone map is gone").toBeGreaterThan(0);
    for (const [, panel, tone] of bands) {
      expect(
        renderer,
        `${panel} has a band colour and no pill colour`,
      ).toContain(`"${panel}": "bg-band-${tone}-strong"`);
    }
  });

  it("defines each strong tone in every light block, and the dark one", () => {
    /*
      Three light blocks have to stay in step — `:root`, `.storefront-light`
      and the theme map Tailwind reads — plus `html.dark`. A tone defined in
      one and not another is a pill that changes colour inside the builder's
      preview island.
    */
    const css = read(CSS);

    for (const tone of ["rose", "mint", "sand", "sky"]) {
      const defined = css.split(`--band-${tone}-strong:`).length - 1;
      expect(defined, `--band-${tone}-strong is defined ${defined} times, expected 3`).toBe(3);
      expect(css, `band-${tone}-strong is not mapped for Tailwind`).toContain(
        `--color-band-${tone}-strong:`,
      );
    }
  });

  it("keeps the neutral pill for a band with no tint", () => {
    /*
      SCOPED TO THE PILL. A first draft asked the whole file and survived the
      mutation, because `SectionShell` spells the same fallback for the PANEL
      a few hundred lines above — a different control with the same default.
    */
    const file = codeOf(read(RENDERER));
    const at = file.indexOf("function ViewAllLink(");
    expect(at, "ViewAllLink is gone").toBeGreaterThan(-1);
    const pill = file.slice(at, file.indexOf(N + "function ", at + 10));

    expect(pill, "the neutral pill is gone from an untinted band").toContain(
      '?? "bg-cream-200"',
    );
  });

  it("is told which band it is on at every call site", () => {
    /*
      The prop existing proves nothing about who passes it. A call site that
      forgets it gets the neutral pill on a tinted band — the exact thing this
      file is about, and silent.
    */
    const calls = codeOf(read(RENDERER)).match(/<ViewAllLink[^>]*>/g) ?? [];

    expect(calls.length, "the homepage draws no view-all links").toBeGreaterThan(3);
    for (const call of calls) {
      expect(call, `a view-all does not know its band: ${call}`).toContain("on=");
    }
  });
});
