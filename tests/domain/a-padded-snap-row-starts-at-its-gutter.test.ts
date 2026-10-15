/**
 * A row that snaps and has a gutter must snap TO the gutter.
 *
 * The homepage's "Shop by category" row on a phone is `-mx-4 px-4 snap-x`: the
 * negative margin runs the scroll to the edge of the screen, the padding puts
 * the first tile back on the page's 16px gutter. But scroll snapping measures
 * from the scroller's edge, not from its padding — so on load the browser
 * snapped the first tile flush to the glass. scrollLeft 16, gutter gone, the
 * first tile touching the edge of the phone.
 *
 * `scroll-px-*` (scroll-padding) is what tells the snap where the gutter is.
 * Whatever `px-*` the row carries at its base size, it needs the same
 * `scroll-px-*` — this pins that for every snapping row, not the one that was
 * found.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

const ROOTS = ["apps", "components", "features", "app", "layouts"];
const SKIP = new Set(["node_modules", ".next", ".git", "dist", "playwright-report"]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** What is wrong with one class string, or null. Only unprefixed (phone) classes count. */
function snapGutterProblem(classes: string): string | null {
  const tokens = classes.split(/\s+/);
  if (!tokens.includes("snap-x")) return null;
  const pad = tokens.find((t) => /^(px|pl)-\d+(\.\d+)?$/.test(t));
  if (!pad) return null;
  const size = pad.split("-")[1];
  const wanted = [`scroll-px-${size}`, `scroll-pl-${size}`];
  return tokens.some((t) => wanted.includes(t)) ? null : `${pad} without ${wanted[0]}`;
}

/** Every double-quoted string in a .tsx file that mentions snap-x. */
function snapStrings(): { file: string; value: string }[] {
  const found: { file: string; value: string }[] = [];
  for (const root of ROOTS) {
    for (const file of walk(join(process.cwd(), root))) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/"([^"\n]*\bsnap-x\b[^"\n]*)"/g)) {
        found.push({ file: relative(process.cwd(), file).split(sep).join("/"), value: match[1] });
      }
    }
  }
  return found;
}

describe("a snapping row with a gutter", () => {
  it("flags the shape that pushed the first tile to the edge", () => {
    // The category row exactly as it shipped. If this stops being caught, the
    // check below proves nothing.
    expect(
      snapGutterProblem(
        "no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:px-0",
      ),
    ).toBe("px-4 without scroll-px-4");
  });

  it("snaps to its padding everywhere", () => {
    const strings = snapStrings();
    // Not vacuous: the category row itself is one of these.
    expect(strings.some((s) => s.file.endsWith("homepage-section-renderer.tsx"))).toBe(true);

    const problems = strings
      .map((s) => ({ ...s, problem: snapGutterProblem(s.value) }))
      .filter((s) => s.problem)
      .map((s) => `${s.file}: ${s.problem}`);
    expect(problems).toEqual([]);
  });
});
