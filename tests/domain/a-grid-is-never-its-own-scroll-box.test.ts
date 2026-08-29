/**
 * A grid must never also be the element that caps its own height.
 *
 * The media picker rendered `grid max-h-80 overflow-y-auto` on one element, and
 * every thumbnail came out as a ~13px strip. Two rules meet badly there:
 *
 *  - each tile carries `overflow-hidden`, which makes it a scroll container,
 *    and a scroll container's automatic minimum size is 0 rather than its
 *    content height (CSS Grid §6.6). So every implicit row's base size is 0.
 *  - the height cap then gives the grid a FINITE amount of free space, and
 *    "Maximize Tracks" (§12.6) shares that out EQUALLY across rows. 320px over
 *    thirteen rows is 13px each — nowhere near the ~237px a tile wants.
 *
 * The thumbnail itself was never squashed; the button around it was 13px and
 * clipped it. And the box never scrolled, because every row had been fitted
 * inside it — which is the giveaway, not the thin tiles.
 *
 * It looked fine with three images or fewer: one row, no free space to
 * misdistribute. That is why it shipped.
 *
 * The cure is structural — put the cap on a plain block and let the grid inside
 * it overflow — so this test pins the SHAPE rather than any one screen. The
 * Media Library grid has always had this shape and has always rendered
 * correctly, which is the counter-example the fix was copied from.
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

/** Every `className="..."` string literal, with the file it came from. */
function classNameLiterals(): { file: string; value: string }[] {
  const found: { file: string; value: string }[] = [];
  for (const root of ROOTS) {
    for (const file of walk(join(process.cwd(), root))) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/className="([^"]*)"/g)) {
        found.push({
          file: relative(process.cwd(), file).split(sep).join("/"),
          value: match[1],
        });
      }
    }
  }
  return found;
}

/** `grid`, `inline-grid`, or either behind a variant such as `sm:`. */
function setsDisplayGrid(className: string): boolean {
  return className
    .split(/\s+/)
    .some((token) => /^(?:[\w-]+:)*(?:inline-)?grid$/.test(token));
}

function capsItsHeight(className: string): boolean {
  return className.split(/\s+/).some((token) => /^(?:[\w-]+:)*max-h-/.test(token));
}

const literals = classNameLiterals();

describe("a grid is never its own height-capped box", () => {
  /**
   * The three guards below exist because a scanner that silently matches
   * nothing passes this file while proving nothing — a failure mode this repo
   * has hit before.
   */
  it("actually scanned the codebase", () => {
    expect(literals.length, "the walker found no className literals at all").toBeGreaterThan(500);
    expect(literals.some((l) => l.file.startsWith("apps/admin/"))).toBe(true);
    expect(literals.some((l) => l.file.startsWith("features/"))).toBe(true);
  });

  it("can still recognise a grid", () => {
    // If this ever fails, `setsDisplayGrid` has stopped matching and the real
    // assertion below is vacuous.
    expect(literals.filter((l) => setsDisplayGrid(l.value)).length).toBeGreaterThan(20);
  });

  it("can still recognise a height cap", () => {
    expect(literals.filter((l) => capsItsHeight(l.value)).length).toBeGreaterThan(5);
  });

  it("never puts both on one element", () => {
    const offenders = literals
      .filter((l) => setsDisplayGrid(l.value) && capsItsHeight(l.value))
      .map((l) => `${l.file}: ${l.value}`);

    expect(
      offenders,
      "put the height cap on a plain wrapper and let the grid inside it overflow — " +
        "otherwise the rows share the capped height equally instead of reaching their content size",
    ).toEqual([]);
  });
});
