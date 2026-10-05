import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * THE ROWS THAT SCROLL SIDEWAYS, AND WHAT THEY SHOW WHILE DOING IT.
 *
 * Two decisions live here, both the shop's:
 *
 *   - the previous/next arrows belong on a screen at least 1400px wide, and
 *     everywhere else the row is moved by scrolling it;
 *   - no scrolling row ever paints a scrollbar.
 *
 * Neither had any test at all. The arrows had never been guarded anywhere in
 * the repo, and the scrollbar rule was three hand-copied class lists that had
 * already drifted apart — one row carried all three properties, one carried
 * two, and the tabbed rail's tab strip carried none, so it painted a bar in
 * every browser there is. Measured at 390px: 196px of overflow with the bar on
 * show, under the tabs, on the row nobody had checked.
 *
 * Nothing here can measure a window — jsdom reports every width as 0 — so
 * these are the rules as written. The widths themselves are measured in
 * tests/e2e/a-row-scrolls-without-saying-so.spec.ts.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";
const CSS = "app/globals.css";

const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

/** The body of ScrollStrip, so a guard cannot be satisfied by another band. */
function strip(): string {
  const src = codeOf(read(RENDERER));
  const at = src.indexOf("function ScrollStrip(");
  expect(at, "ScrollStrip is gone").toBeGreaterThan(-1);
  const next = src.indexOf("\nfunction ", at + 10);
  return src.slice(at, next < 0 ? src.length : next);
}

const CUT = "min-[1400px]:";

describe("the arrows on a row that scrolls", () => {
  it("are drawn only on a screen at least 1400px wide", () => {
    const body = strip();
    const at = body.indexOf("const arrow =");
    expect(at, "the arrow class is gone").toBeGreaterThan(-1);
    const arrow = body.slice(at, body.indexOf(";", at));

    expect(arrow, "the arrows are drawn at every width again").toContain("hidden");
    expect(arrow, "the arrows never appear at any width").toContain(CUT + "flex");
  });

  it("and the hero's arrows use the very same number", () => {
    /*
      TWO FILES, ONE NUMBER. The hero's chevrons and the rows' are drawn by
      different components, and the shop asked for them to appear together —
      so a page that grew its controls in two stages, at 1280 and again at
      1400, would be the bug. Nothing but this ties them.

      Scoped to each button: checking the file for one occurrence passed with
      the Previous arrow moved and the Next one left behind, which is both a
      real way to write it and the harder one to see.
    */
    const hero = codeOf(read("features/cms-sections/hero-carousel.tsx"));

    for (const which of ["Previous", "Next"]) {
      const at = hero.indexOf(`aria-label="${which} slide"`);
      expect(at, `the hero's ${which} arrow is gone`).toBeGreaterThan(-1);

      // The button's own class list, cut at its closing `)}` so the slice
      // cannot run on into the next button and read ITS classes.
      const rest = hero.slice(at);
      const button = rest.slice(0, rest.indexOf(")}"));

      expect(button, `the hero's ${which} arrow is drawn at every width`).toContain("hidden");
      expect(button, `the hero's ${which} arrow is on a different cut`).toContain(CUT + "flex");
    }
  });

  it("and are big enough to press wherever they are drawn", () => {
    // 36px was under the floor for a pointer and well under it for anything
    // else. They only appear on the roomiest screens now, so there is no
    // reason for them to be the smallest control on the page.
    const body = strip();
    const at = body.indexOf("const arrow =");
    const arrow = body.slice(at, body.indexOf(";", at));

    expect(arrow, "the row arrows shrank again").toContain("size-11");
  });

  it("and the gate is not cancelled by the class beside it", () => {
    /*
      THE TRAP THIS WHOLE CASE EXISTS FOR.

      The string used to carry a bare `flex`. `hidden` and `flex` are the same
      display group, so adding `hidden` in front of it and leaving `flex`
      alone changes nothing at all: tailwind-merge keeps the later one and the
      arrows stay on every screen, with the diff looking exactly right.
    */
    const body = strip();
    const at = body.indexOf("const arrow =");
    const arrow = body.slice(at, body.indexOf(";", at));

    expect(
      / flex |"flex /.test(arrow),
      "a bare `flex` sits beside the gate and cancels it",
    ).toBe(false);
  });

  it("and leave the tab order when they are not drawn", () => {
    // `hidden` is display:none, which takes the button out of the tab order.
    // `invisible`, `opacity-0` and an sr-only trick all leave a keyboard
    // walking into a control nobody can see — and sr-only is position:absolute,
    // which is its own escaped-containing-block bug.
    const body = strip();
    const at = body.indexOf("const arrow =");
    const arrow = body.slice(at, body.indexOf(";", at));

    for (const cheat of ["invisible", "opacity-0", "sr-only"]) {
      expect(arrow.includes(cheat), `the arrows are hidden with ${cheat}`).toBe(false);
    }
  });

  it("and are still drawn only when the row has somewhere to go", () => {
    // The width gate stacks on the measurement; it does not replace it. A pair
    // of dead chevrons either side of a row of four that fits is a control
    // that lies about what it does.
    const body = strip();

    expect(body, "the arrows no longer wait for an overflow").toContain("canScroll.back");
    expect(body, "the arrows no longer wait for an overflow").toContain("canScroll.forward");
  });
});

describe("the scrollbar on a row that scrolls", () => {
  it("is hidden by one rule, in one place", () => {
    const css = read(CSS);
    const at = css.indexOf(".no-scrollbar {");
    expect(at, "the shared rule is gone").toBeGreaterThan(-1);
    const rule = css.slice(at, css.indexOf("}", at));

    // Three properties, because no one of them covers a browser on its own.
    expect(rule, "Firefox and the standard").toContain("scrollbar-width: none");
    expect(rule, "the old Edge").toContain("-ms-overflow-style: none");
    expect(css, "Chrome, Edge and Safari").toContain(".no-scrollbar::-webkit-scrollbar");
  });

  it("and every sideways row on the homepage wears it", () => {
    /*
      SCOPED TO THE LINE, not to the file. A count of `no-scrollbar` in the
      whole renderer passes with two rows wearing it twice and the third
      wearing nothing — which, with three hand-copied class lists, is exactly
      the shape the bug had.
    */
    // Comments stripped first: the prose above one of these rows explains what
    // `overflow-x-auto` clips, and a raw scan read that sentence as a row.
    const lines = codeOf(read(RENDERER)).split("\n");
    const sideways = lines.filter((line) => line.includes("overflow-x-auto"));

    expect(sideways.length, "the sideways rows have moved or gone").toBeGreaterThanOrEqual(3);
    for (const line of sideways) {
      expect(
        line.includes("no-scrollbar"),
        `a row scrolls sideways with its bar on show: ${line.trim().slice(0, 80)}`,
      ).toBe(true);
    }
  });

  it("and nobody has quietly gone back to copying the properties by hand", () => {
    // What drifted the first time. If these reappear, a fourth divergent copy
    // is being written and this rule stops being the one place.
    const renderer = read(RENDERER);

    for (const raw of ["[scrollbar-width:none]", "[&::-webkit-scrollbar]:hidden"]) {
      expect(renderer.includes(raw), `${raw} is hand-copied again`).toBe(false);
    }
  });

  it("but a box that scrolls DOWN keeps its bar", () => {
    /*
      NOT A BLANKET SWEEP, and this is the line the sweep must not cross. A
      vertical bar is usually the only thing telling a customer that a box is
      showing less than it holds — the checkout's order summary is capped at
      max-h-72 and the phone's navigation drawer scrolls, and each one's bar
      is the only signal there is more below. The product page's thumbnail
      rail is the same: on a large screen it is a vertical strip beside the
      photograph.
    */
    const gallery = read("components/storefront/product-gallery.tsx");
    const at = gallery.indexOf("lg:overflow-y-auto");
    expect(at, "the thumbnail rail no longer scrolls").toBeGreaterThan(-1);

    const line = gallery.slice(gallery.lastIndexOf("\n", at) + 1, gallery.indexOf("\n", at));
    expect(
      line.includes("no-scrollbar"),
      "a downward-scrolling rail was swept up with the sideways ones",
    ).toBe(false);
  });
});
