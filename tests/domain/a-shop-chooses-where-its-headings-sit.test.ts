import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { HOMEPAGE_SECTION_REGISTRY } from "@/constants/section-registry";
import { sectionAlignOf } from "@/features/cms-sections/lib/section-utils";

/**
 * WHERE A SECTION'S HEADING SITS — left, centre or right, the shop's choice.
 *
 * TWO THINGS HAVE TO BE TRUE AT ONCE and they pull against each other:
 *
 *   1. every page already published must look EXACTLY as it did. Twelve
 *      section types draw their heading left and thirteen draw it centred, and
 *      not one layout in the database carries this key — so the blank path is
 *      not an edge case, it is what every band on every live page is using.
 *      A single shared default would have re-aligned twelve of them.
 *
 *   2. the control must actually move something. On nine of the section types
 *      the heading is a flex child that hugs its own text, and `text-center`
 *      on a box the width of its own words moves nothing at all. Measured
 *      before the row shapes were changed: setting the tabbed rail to centre
 *      and then to right put the heading in the same place both times.
 *
 * Neither is visible in a diff. The pixels are measured in
 * tests/e2e/a-shop-chooses-where-its-headings-sit.spec.ts; this file holds the
 * wiring that lets them be measured at all.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";

const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

/**
 * The twelve that are drawn left today.
 *
 * Written out rather than derived, because deriving it from the renderer
 * would make this list agree with whatever the renderer happens to say — and
 * agreeing with the thing under test is not a check.
 */
const LEFT = [
  /* `seo-prose` stood second here until it was deleted. */
  "tabbed-rail", "banner-grid", "banner-strip",
  "featured-cakes", "trending", "best-sellers", "category-rail",
  "photo-cakes", "eggless", "seasonal",
  // The band that draws what a browser has looked at, added later.
  "recently-viewed",
];

/**
 * The two with no heading of their own to place.
 *
 * It read `["hero", "store-locator", "newsletter", "cta"]` and the last three
 * are deleted. It was also INCOMPLETE: `same-day-countdown` has no align
 * control either and was never listed — the hard count beside it was carrying
 * that gap. Measured against the registry rather than remembered.
 */
const NO_CONTROL = ["hero", "same-day-countdown"];

describe("a shop chooses where its headings sit", () => {
  it("offers the choice on every section that has a heading of its own", () => {
    const withControl = HOMEPAGE_SECTION_REGISTRY.filter((entry) =>
      entry.fields.some((f) => f.key === "align"),
    ).map((entry) => entry.type);

    /* 20 section types, less the two above. Measured, not adjusted to pass. */
    expect(withControl.length, "the control is on the wrong number of sections").toBe(18);
    for (const type of LEFT) {
      expect(withControl, `${type} cannot choose`).toContain(type);
    }
    for (const type of NO_CONTROL) {
      /*
        NOT OFFERED, and each for its own reason. `hero` has no section
        heading at all, and `same-day-countdown` draws its own line inside a
        band whose layout a heading control could not move.

        Three more stood here — store-locator, newsletter and cta — each
        drawing its own <h2> inside a card whose `text-center` also centred
        the buttons and the form under it. All three are deleted.
      */
      expect(withControl, `${type} has a control that cannot work`).not.toContain(type);
    }
  });

  it("and ships it blank, so nothing already published moves", () => {
    for (const entry of HOMEPAGE_SECTION_REGISTRY) {
      const field = entry.fields.find((f) => f.key === "align");
      if (!field) {
        expect(entry.defaultContent.align, `${entry.type} stores an align it cannot edit`)
          .toBeUndefined();
        continue;
      }
      expect(entry.defaultContent.align, `${entry.type} ships with a position chosen`).toBe("");
    }
  });

  it("and the blank option comes first, and says what blank means", () => {
    /*
      THE BUILDER SHOWS options[0] FOR A VALUE IT HAS NOT GOT, and never
      writes it. So if the first option were "Left", every one of the thirteen
      centred sections would show "Left" in the dropdown while drawing
      centred — the editor lying about a page it has not touched. The
      registry already warns about this next to `copySide`.

      And blank does not mean the same thing twice: twelve sections are left
      by default and thirteen centred, so the label has to say which.
    */
    for (const entry of HOMEPAGE_SECTION_REGISTRY) {
      const field = entry.fields.find((f) => f.key === "align");
      if (!field) continue;

      const values = field.options?.map((o) => o.value) ?? [];
      expect(values, `${entry.type}'s positions`).toEqual(["", "left", "center", "right"]);
      expect(field.options![0].label, `${entry.type}'s blank option`).toBe(
        LEFT.includes(entry.type) ? "Default (left)" : "Default (center)",
      );
    }
  });

  it("reads a stored value, and anything else falls back to the caller's", () => {
    // The fallback is the caller's precisely because it is not one value.
    expect(sectionAlignOf({ align: "right" }, "left")).toBe("right");
    expect(sectionAlignOf({ align: "center" }, "left")).toBe("center");
    expect(sectionAlignOf({ align: "left" }, "center")).toBe("left");

    // What every live band is actually doing: no key at all.
    expect(sectionAlignOf({}, "left")).toBe("left");
    expect(sectionAlignOf({}, "center")).toBe("center");

    // An unrecognised value is not a request for something else.
    for (const junk of ["", " ", "middle", "start", "justify", "LEFT"]) {
      expect(sectionAlignOf({ align: junk }, "center"), junk).toBe("center");
    }
    expect(sectionAlignOf({ align: 3 as never }, "left")).toBe("left");
  });

  it("gives every heading in the renderer a resolved value", () => {
    /*
      SCOPED TO THE CALL SITES, not counted. A file-wide search for
      `align={align}` passes with one section left behind, and the section
      left behind is the one whose dropdown quietly does nothing.
    */
    const src = codeOf(read(RENDERER));
    const bare: string[] = [];

    let at = src.indexOf("<SectionHeader");
    while (at > -1) {
      const element = src.slice(at, src.indexOf("/>", at));
      if (!element.includes("align=")) bare.push(element.slice(0, 60).trim());
      at = src.indexOf("<SectionHeader", at + 10);
    }

    expect(bare, `${bare.length} headings take no position`).toEqual([]);
  });

  it("and resolves it from the section's own fallback, per function", () => {
    /*
      TWELVE LEFT, THIRTEEN CENTRED. One shared default is the single change
      that would break the promise this whole file is about, and it is a
      one-word edit that reads as tidying.
    */
    const src = codeOf(read(RENDERER));
    const calls = [...src.matchAll(/sectionAlignOf\(c, "(left|center)"\)/g)].map((m) => m[1]);

    /*
      Was 18 / 6 / 13. Nine sections went, and with them one left-hand
      fallback and five centred ones.
    */
    expect(calls.length, "the fallbacks have moved or gone").toBeGreaterThanOrEqual(13);
    expect(calls.filter((v) => v === "left").length, "the left-hand sections").toBe(5);
    expect(calls.filter((v) => v === "center").length, "the centred sections").toBe(8);
  });

  it("draws a mirror when it centres a heading that shares its row", () => {
    /*
      WITHOUT THE MIRROR, CENTRE IS RIGHT. The row is `justify-between`, so
      with a grown spacer in front and a heading that hugs its text, the
      heading is the LAST item and lands at the end. Measured on the tabbed
      rail: centre and right both put it at 1082..1224.

      It is drawn even when there is no control to put in it, which is the
      case that was wrong.
    */
    const src = codeOf(read(RENDERER));
    const at = src.indexOf("function SectionHeadingRow(");
    expect(at, "the shared heading row is gone").toBeGreaterThan(-1);
    const row = src.slice(at, src.indexOf("\nfunction ", at + 10));

    expect(row, "the leading mirror is gone").toContain(
      'centred ? <div className="hidden flex-1 sm:block" aria-hidden="true" /> : null',
    );
    expect(row, "the trailing mirror is only drawn when there is something in it").toContain(
      "centred || trailing",
    );
    // And the heading takes the row's free space when it is NOT centred, or
    // `text-right` has nothing to push against.
    expect(row, "a heading ranged right has no room to move in").toContain(
      '!centred && "flex-1"',
    );
  });

  it("and the heading component knows the third edge", () => {
    const header = codeOf(read("components/shared/section-header.tsx"));

    expect(header, "right is not drawn").toContain('align === "right" && "text-right"');
    expect(header, "centre lost its clamp").toContain(
      'align === "center" && "mx-auto max-w-2xl text-center"',
    );
  });
});
