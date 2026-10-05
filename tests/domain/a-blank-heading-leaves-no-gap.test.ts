import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { sectionHeaderDraws } from "@/components/shared/section-header";

/**
 * SPACING UNDER A HEADING BELONGS TO THE HEADING.
 *
 * Every band on the homepage puts a top margin on whatever follows its
 * heading. With a heading that margin collapses against the heading's own
 * `mb-6` and the gap is right. With a BLANK heading the heading draws nothing,
 * the margin has nothing to collapse against, and the band carries a band of
 * air above its content that is not there below it.
 *
 * The shop found it by drawing a red box round the empty strip above its
 * promises band. Measured at 1440 afterwards: FOUR bands were carrying it —
 * why-us, both promo collages and the gift tile grid — each 48px above and
 * 24px below, and every one of them has a blank heading. Four section types
 * ship `title: ""` on purpose, so this is the ordinary case rather than an
 * edge one.
 *
 * Nothing in the diff shows it. `mt-6` beside a heading that is not there
 * looks exactly like `mt-6` beside a heading that is.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";

const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

/**
 * Every top margin that follows a heading, with the band it belongs to.
 *
 * Read from the call site rather than counted, because the fault is not "how
 * many margins are conditional" — it is "is there one that is not".
 */
function marginsAfterHeadings(): { band: string; line: string; guarded: boolean }[] {
  const lines = codeOf(read(RENDERER)).split("\n");
  const found: { band: string; line: string; guarded: boolean }[] = [];
  let band = "";

  for (let i = 0; i < lines.length; i += 1) {
    const declared = lines[i].match(/^function ([A-Z][A-Za-z]*)\(/);
    if (declared) band = declared[1];
    if (!lines[i].includes("<SectionHeader")) continue;

    let end = i;
    while (end < lines.length && !lines[end].includes("/>")) end += 1;

    for (let j = end + 1; j < Math.min(end + 18, lines.length); j += 1) {
      if (lines[j].includes("<SectionHeader")) break;
      if (!/"mt-\d/.test(lines[j]) && !/hasHeading && "mt-\d/.test(lines[j])) continue;
      /*
        GUARDED IN ANY FORM, AND ON ANY OF THE THREE LINES AROUND IT.

        `hasHeading && "mt-6"` is one shape and fits on the margin's own line.
        The price cards ask the same question as a ternary — their link sits
        under the heading on a phone and out of the flow beside it above — and
        prettier puts the condition two lines above the class it chooses.
        Reading the margin's line alone reported that as a fault twice over.
      */
      const around = lines.slice(Math.max(0, j - 2), j + 1).join(" ");
      found.push({
        band,
        line: lines[j].trim().slice(0, 70),
        guarded: around.includes("hasHeading"),
      });
      break;
    }
  }
  return found;
}

describe("a blank heading leaves no gap", () => {
  it("is asked once, by the component that draws the heading", () => {
    /*
      EXPORTED FROM THERE, not written out at each band. The rule for what
      counts as a heading lives in SectionHeader, and the two drifting apart
      is this same fault in a subtler form — a band leaving its margin in
      because it disagrees about whether an overline alone is a heading.
    */
    expect(sectionHeaderDraws("", "", "")).toBe(false);
    expect(sectionHeaderDraws(" ", "  ", " ")).toBe(false);
    expect(sectionHeaderDraws(undefined, undefined, undefined)).toBe(false);

    expect(sectionHeaderDraws("", "Why Choose Us")).toBe(true);
    expect(sectionHeaderDraws("Welcome", "")).toBe(true);
    expect(sectionHeaderDraws("", "", "a line under it")).toBe(true);
  });

  it("and the component itself uses that answer", () => {
    // Or the helper is a second opinion rather than the rule.
    const header = codeOf(read("components/shared/section-header.tsx"));
    const at = header.indexOf("export function SectionHeader(");
    expect(at, "SectionHeader is gone").toBeGreaterThan(-1);

    expect(
      header.slice(at),
      "the heading decides for itself whether it draws",
    ).toContain("sectionHeaderDraws(");
  });

  it("and every margin that follows a heading waits for one", () => {
    const margins = marginsAfterHeadings();

    // The scan has to find something, or every case here passes on nothing.
    expect(margins.length, "no band puts a margin after its heading").toBeGreaterThan(8);

    const bare = margins.filter((m) => !m.guarded);
    expect(
      bare.map((m) => `${m.band}: ${m.line}`),
      `${bare.length} bands hold a gap open for a heading they may not have`,
    ).toEqual([]);
  });
});
