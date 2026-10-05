import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { HOMEPAGE_SECTION_REGISTRY } from "@/constants/section-registry";

/**
 * HOW MANY TABS THE ROW DRAWS.
 *
 * Separate from deleting the tab rows, because the two are different things:
 * a shop that wants three tabs on the page and two more ready to swap in
 * should not have to retype them.
 *
 * The load-bearing part is the DEFAULT. 0 — and a missing value, which is
 * every row saved before this setting existed — has to mean every tab. A
 * default of 3 or 4 would silently drop the fourth tab off rows that are
 * already live, and nothing would fail.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

function body(): string {
  const src = codeOf(read("features/cms-sections/homepage-section-renderer.tsx"));
  const at = src.indexOf("function TabbedRailSection(");
  expect(at, "TabbedRailSection is gone").toBeGreaterThan(-1);
  const rest = src.slice(at + 10);
  const next = rest.search(/\n(?:export )?function /);
  return next < 0 ? src.slice(at) : src.slice(at, at + 10 + next);
}

describe("how many tabs a row draws", () => {
  const entry = HOMEPAGE_SECTION_REGISTRY.find((s) => s.type === "tabbed-rail");

  it("is a setting the shop can change", () => {
    expect(entry, "the tabbed rail is gone from the registry").toBeTruthy();

    const field = entry!.fields.find((f) => f.key === "maxTabs");
    expect(field, "there is no box for how many tabs to show").toBeTruthy();
    expect(field!.type).toBe("number");
  });

  it("ships meaning every tab, so nothing already live loses one", () => {
    /*
      A default of 3 would drop the fourth tab off every row already saved,
      silently. 0 is the only safe shipped value, and the renderer has to
      read it as "all" rather than as "none".
    */
    expect(entry!.defaultContent.maxTabs).toBe(0);

    const section = body();
    expect(section, "the cap is not read from the section").toMatch(
      /contentNumber\(c, "maxTabs", 0\)/,
    );
    expect(section, "0 no longer means every tab").toMatch(
      /maxTabs > 0 \?[^:]+: declared/,
    );
  });

  it("caps what is drawn, not what is stored", () => {
    // The rows stay in the builder; only the page draws fewer. Asserted by
    // the slice being on the DRAWN list rather than on the parsed one.
    const section = body();

    expect(section).toMatch(/const declared = renderableRows\(parseListField/);
    expect(section).toMatch(/declared\.slice\(0, maxTabs\)/);
  });
});
