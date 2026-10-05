/**
 * THE PANEL'S POSITION IS MEASURED NOW, NOT COUNTED.
 *
 * Which edge a mega panel hung from came from the row's place in an array:
 *
 *   bandRows.length >= 6 && index >= Math.floor(bandRows.length / 2)
 *     ? "right" : "left"
 *
 * Index is not geometry, and the gap is not a near miss. Measured in a browser
 * at 1024px — the narrowest width the band exists at, since it is
 * `hidden lg:grid` and `lg` is 1024 — with the band's rows cloned so the real
 * flex layout placed them:
 *
 *   row  x     w     left-anchored      right-anchored
 *   0    32    139   [  32,  672] ok    [-469, 171] off
 *   3    396   139   [ 396, 1036] off   [-105, 535] off   <-- NEITHER
 *   6    826   139   [ 826, 1466] off   [ 325, 965] ok
 *   7    32    139   [  32,  672] ok    [-469, 171] off   <-- WRAPPED to line 2
 *
 * Two separate facts kill the counted version:
 *
 *   - AT 1024 THERE IS A BAND OF POSITIONS WITH NO ANSWER. Some edge fits only
 *     when the window is at least `2P - w` wide — 1141px for a 640px panel on a
 *     139px row. Row 3 sits in the gap, so no choice of edge is correct.
 *   - ONCE THE BAND WRAPS, INDEX STOPS TRACKING x. Rows 7 and 8 restart at the
 *     left margin on a second line while their index keeps climbing, so the
 *     predicate called them right-anchored and put row 7's panel at [-487, 153].
 *
 * And nothing went red for any of it: a box hanging off the LEFT adds nothing
 * to `scrollWidth` in a left-to-right document, so even the guard that exists
 * to catch a panel leaving the window could not see it. This shop has THREE
 * band rows, so the whole thing was latent — the FOURTH row a shop adds is the
 * one that breaks, and this shop's plan is a row per kind of thing it sells.
 *
 * EVERY EXPECTED NUMBER BELOW IS COMPUTED BY HAND from the measured geometry
 * and the window, never by re-running `panelShift`. A case whose expectation
 * comes out of the function under test passes for any formula at all.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { panelShift } from "@/features/site-layout/lib/menu-links";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const PANEL = 640;

describe("how far a panel slides to stay in the window", () => {
  it("leaves a panel that already fits exactly where it was", () => {
    /*
      THE ANSWER FOR EVERY ROW ON THIS SHOP, and therefore the one the server
      renders. 32 + 640 = 672, inside 1024 with room to spare, so there is
      nothing to do and the panel stays under its own trigger.
    */
    expect(panelShift({ triggerLeft: 32, panelWidth: PANEL, clientWidth: 1024 })).toBe(0);
    expect(panelShift({ triggerLeft: 175, panelWidth: PANEL, clientWidth: 1024 })).toBe(0);
    expect(panelShift({ triggerLeft: 271, panelWidth: PANEL, clientWidth: 1024 })).toBe(0);
  });

  it("answers the position no edge could answer", () => {
    /*
      ROW 3, THE ONE THAT BROKE BOTH EDGES. By hand: the panel may start no
      later than 1024 - 16 - 640 = 368 and still end inside the gutter. The
      trigger is at 396, so it moves back 28px — and 368 + 640 = 1008, which is
      1024 - 16. Exactly the gutter, and not a pixel further than needed.
    */
    expect(panelShift({ triggerLeft: 396, panelWidth: PANEL, clientWidth: 1024 })).toBe(-28);
  });

  it("stops at the gutter however far along the band the row is", () => {
    /*
      Rows 4, 5 and 6 at 1024, hand-computed as 368 - x. They all land on the
      same right edge, which is the point: the panel is as close to its own
      trigger as the window allows and never further.
    */
    expect(panelShift({ triggerLeft: 540, panelWidth: PANEL, clientWidth: 1024 })).toBe(368 - 540);
    expect(panelShift({ triggerLeft: 683, panelWidth: PANEL, clientWidth: 1024 })).toBe(368 - 683);
    expect(panelShift({ triggerLeft: 826, panelWidth: PANEL, clientWidth: 1024 })).toBe(368 - 826);
  });

  it("and a row that wrapped to the second line is back at the left margin", () => {
    /*
      THE CASE INDEX GOT EXACTLY BACKWARDS. Rows 7 and 8 measured x=32 and
      x=175 with trigger tops of 131 against 95 for the first line — the same x
      as rows 0 and 1, so the same answer: nothing. The counted version sent
      row 7's panel to [-487, 153] instead.
    */
    expect(panelShift({ triggerLeft: 32, panelWidth: PANEL, clientWidth: 1024 })).toBe(0);
    expect(panelShift({ triggerLeft: 175, panelWidth: PANEL, clientWidth: 1024 })).toBe(0);
  });

  it("gives a wider window its slack back", () => {
    /*
      Hand-computed: the last start is 1280 - 16 - 640 = 624, and
      1440 - 16 - 640 = 784. Row 3 needs 28px at 1024 and NOTHING at 1280 — the
      same row, the same band, two answers. That is the fact a single stored
      choice of edge cannot represent, whatever the arithmetic behind it.
    */
    expect(panelShift({ triggerLeft: 396, panelWidth: PANEL, clientWidth: 1280 })).toBe(0);
    expect(panelShift({ triggerLeft: 396, panelWidth: PANEL, clientWidth: 1440 })).toBe(0);
    expect(panelShift({ triggerLeft: 683, panelWidth: PANEL, clientWidth: 1280 })).toBe(624 - 683);
    expect(panelShift({ triggerLeft: 826, panelWidth: PANEL, clientWidth: 1440 })).toBe(784 - 826);
  });

  it("and a narrower panel needs less of it", () => {
    /*
      The panel is 15rem with one column and 27rem with two — see `panelShape`.
      A one-column panel at row 6 fits with 20px to spare at 1024: 826 + 240 is
      1066... which does NOT fit, so it moves to 1024 - 16 - 240 = 768.
      Hand-computed, including the correction: the first number written here
      was wrong and the arithmetic is what caught it.
    */
    expect(panelShift({ triggerLeft: 826, panelWidth: 240, clientWidth: 1024 })).toBe(768 - 826);
    /* And a one-column panel early in the band needs nothing at all. */
    expect(panelShift({ triggerLeft: 271, panelWidth: 240, clientWidth: 1024 })).toBe(0);
  });

  it("never pushes a panel off the LEFT to save the right", () => {
    /*
      THE FAILURE MODE OF A CLAMP WITH INVERTED BOUNDS. Hand it a panel wider
      than the window and the last legal start is NEGATIVE — 1024 - 16 - 1200
      is -192 — so a clamp that trusted that bound would return -224 and push
      the panel off the very side it was protecting. Off-screen LEFT is the
      direction nothing in this repo can see.

      The answer instead is the LEFT GUTTER: an over-wide panel cannot fit, and
      16 shows more of it than its own trigger's 32 does. So the assertion is
      not "nothing moves" — the first draft of this case said 0 and the
      arithmetic refuted it — it is that the panel's left never goes below 16,
      from either side of the clamp.

      The panel's own width is capped at `calc(100vw - 2rem)`, so this cannot
      arrive through the component. That cap lives in another file inside a map
      of class strings, which is exactly why the bound is enforced here rather
      than assumed.
    */
    expect(panelShift({ triggerLeft: 32, panelWidth: 1200, clientWidth: 1024 })).toBe(16 - 32);
    expect(panelShift({ triggerLeft: 400, panelWidth: 1200, clientWidth: 1024 })).toBe(16 - 400);
    for (const triggerLeft of [0, 16, 32, 400, 900]) {
      const shift = panelShift({ triggerLeft, panelWidth: 1200, clientWidth: 1024 });
      expect(triggerLeft + shift, `a ${triggerLeft}px row put the panel off the left`).toBe(16);
    }
  });

  it("and takes the gutter from the panel's own cap, not from a new number", () => {
    /*
      16 is `calc(100vw - 2rem)` halved — the cap the panel has always carried.
      Passing it explicitly must agree with the default, or the default is a
      second number nobody declared.
    */
    const asked = panelShift({ triggerLeft: 396, panelWidth: PANEL, clientWidth: 1024, gutter: 16 });
    const implied = panelShift({ triggerLeft: 396, panelWidth: PANEL, clientWidth: 1024 });
    expect(asked).toBe(implied);
    /* A different gutter must actually move the answer, or the field is dead. */
    expect(panelShift({ triggerLeft: 396, panelWidth: PANEL, clientWidth: 1024, gutter: 0 })).toBe(
      384 - 396,
    );
  });
});

describe("the counted version is gone, not merely unused", () => {
  const navbar = code("apps/website/components/storefront-navbar.tsx");
  const menu = code("components/storefront/mega-menu.tsx");

  it("no edge is chosen from an index anywhere", () => {
    expect(navbar, "the band still counts its way to an edge").not.toMatch(
      /index >= Math\.floor\(bandRows\.length \/ 2\)/,
    );
    expect(navbar, "the six-row threshold is still there").not.toMatch(/bandRows\.length >= 6/);
    expect(navbar, "an align prop is still passed to a menu").not.toContain("align={align}");
    expect(menu, "the panel still switches edges").not.toMatch(/align === "right"/);
    expect(menu, "the right edge is still used").not.toContain("right-0");
  });

  it("the panel hangs from one edge and slides by a measured variable", () => {
    /*
      BOTH HALVES, because either alone is a panel that cannot move.
      `ml-[var(--mega-shift)]` must be a STATIC string: Tailwind reads class
      names as text, so a computed `ml-[${n}px]` compiles to no CSS and the
      panel silently never moves — which would look correct in the source and
      in every unit case above.
    */
    expect(menu, "the panel lost its anchor edge").toContain("left-0");
    expect(menu, "the panel has nothing to slide by").toContain("ml-[var(--mega-shift)]");
    expect(menu, "the variable is interpolated, so it compiles to no CSS").not.toMatch(
      /ml-\[\$\{/,
    );
    /* And the server's answer is declared, so the first paint is not unstyled. */
    expect(menu, "no default shift, so `var()` resolves to nothing before JS").toContain(
      "[--mega-shift:0px]",
    );
  });

  it("and the band measures it, through the shared function", () => {
    expect(navbar, "the navbar does not import the rule").toContain("panelShift");
    expect(navbar, "the arithmetic is written out again instead of shared").not.toMatch(
      /clientWidth - \w*gutter/,
    );
    expect(navbar, "nothing writes the variable").toContain('setProperty("--mega-shift"');

    /*
      BY DOM, NOT BY REF. One observer for the band reaches every panel in it,
      including rows a browser probe clones in to measure where row 4 would
      open — which is the only way to check this without writing nav rows to
      the shop's live database.
    */
    /*
      SCOPED TO THE LOOP THAT MEASURES, and not a `toContain` over the file.
      The marker is read TWICE in this effect — once to measure every panel and
      once to observe every wrapper — so a file-wide `toContain` stayed green
      with the measuring loop pointed at a selector that matches nothing. The
      mutation that proved it changed the first occurrence only.
    */
    const placeAt = navbar.indexOf("const place =");
    expect(placeAt, "the measuring loop moved").toBeGreaterThan(-1);
    const place = navbar.slice(placeAt, navbar.indexOf("const schedule =", placeAt));
    expect(place, "the measuring loop does not find the panels by their marker").toContain(
      '"[data-mega-panel]"',
    );
    expect(place, "the measuring loop reads no geometry").toContain("getBoundingClientRect");

    /*
      AND IT RE-MEASURES. A window can change width without the band's box
      changing at all: a 640px panel needs 28px at 1024 and nothing at 1440
      while the band is 960px in both. Measured: nine rows fit one line at
      1440px and the band did not resize, so the observer alone saw nothing.
    */
    const at = navbar.indexOf("new ResizeObserver");
    expect(at, "nothing watches the band for changes").toBeGreaterThan(-1);
    const effect = navbar.slice(at, at + 900);
    expect(effect, "a resize that leaves the band's box alone is missed").toContain(
      'window.addEventListener("resize"',
    );
    expect(effect, "the row wrappers are not watched, so a renamed row goes stale").toMatch(
      /observer\.observe\(panel\.parentElement\)/,
    );
    expect(effect, "the observer is left running on an unmounted band").toContain(
      "observer.disconnect()",
    );
  });
});
