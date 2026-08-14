import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Tailwind's `sr-only` is `position: absolute`, and an absolutely-positioned
 * element with no positioned ancestor resolves its containing block to the
 * INITIAL one — <body>. It then escapes every `overflow: hidden` in between,
 * including the admin shell's, and lays itself out at its static position
 * inside the scrolled content. On a panel far enough down the page, that
 * position is past the fold, and `documentElement.scrollHeight` grows to reach
 * it: a second scrollbar down the right edge of the window.
 *
 * The dashboard measured 545px too tall and the reports page 732px, for as long
 * as their figures were loading. Anchoring the three shared loading components
 * fixed those two pages and left the identical wrappers inline on the dashboard
 * itself — the fixed twin, in the very commit that documented the cause.
 *
 * SCOPE: loading indicators, i.e. a `role="status"` wrapper holding an
 * `sr-only` label. That is where the defect occurred and where the shape is
 * uniform enough to check by reading. `sr-only` also appears on form labels and
 * dialog titles; those sit inside Radix dialog content, which is
 * `position: fixed` and therefore already anchors them, and a browser probe of
 * the pages carrying the rest found no overflow.
 *
 * Only a browser can prove the SIZE — tests/e2e/no-second-window-scrollbar.spec.ts
 * does that. This is the structural half, so a new loading skeleton cannot
 * reintroduce the class unnoticed.
 */

const ROOTS = ["apps", "components", "features", "layouts"];
const POSITIONED = /\brelative\b|\babsolute\b|\bfixed\b|\bsticky\b/;

function tsxFilesUnder(roots: string[]): string[] {
  const found: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(join(process.cwd(), dir), { withFileTypes: true })) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
        walk(path);
      } else if (entry.name.endsWith(".tsx")) {
        found.push(path);
      }
    }
  };

  for (const root of roots) walk(root);
  return found.sort();
}

/**
 * Every `role="status"` element, as (opening tag, own body) pairs.
 *
 * The body is bounded by the element's OWN closing tag, counted with depth so a
 * nested element of the same name does not end it early. The first version
 * stopped at the next `role="status"` instead, which for the last one in a file
 * swallowed everything after it — and reported a `<p>` of plain text as holding
 * an `sr-only` label that lived two hundred lines further down.
 */
function statusRegions(source: string): { tag: string; body: string }[] {
  const regions: { tag: string; body: string }[] = [];
  let at = source.indexOf('role="status"');

  while (at > -1) {
    const start = source.lastIndexOf("<", at);
    const close = source.indexOf(">", at);
    const name = /^<([A-Za-z][\w.]*)/.exec(source.slice(start))?.[1];

    if (start > -1 && close > -1 && name) {
      // Self-closing indicators have no body to search.
      if (source[close - 1] !== "/") {
        const open = new RegExp(`<${name}[\\s>]`, "g");
        const shut = new RegExp(`</${name}>`, "g");
        open.lastIndex = close + 1;
        shut.lastIndex = close + 1;

        let depth = 1;
        let cursor = close + 1;
        let end = source.length;

        while (depth > 0) {
          open.lastIndex = cursor;
          shut.lastIndex = cursor;
          const nextOpen = open.exec(source);
          const nextShut = shut.exec(source);
          if (!nextShut) break;
          if (nextOpen && nextOpen.index < nextShut.index) {
            depth += 1;
            cursor = nextOpen.index + 1;
            continue;
          }
          depth -= 1;
          cursor = nextShut.index + 1;
          if (depth === 0) end = nextShut.index;
        }

        regions.push({ tag: source.slice(start, close + 1), body: source.slice(close + 1, end) });
      }
    }

    at = source.indexOf('role="status"', at + 1);
  }

  return regions;
}

describe("a loading indicator with a screen-reader label", () => {
  const FILES = tsxFilesUnder(ROOTS);

  it("anchors the label, so it cannot lengthen the page", () => {
    const offenders: string[] = [];

    for (const path of FILES) {
      const source = readFileSync(join(process.cwd(), path), "utf8");

      for (const { tag, body } of statusRegions(source)) {
        if (!body.includes('className="sr-only"')) continue;
        if (POSITIONED.test(tag)) continue;
        offenders.push(`${path} — ${tag.replace(/\s+/g, " ").slice(0, 90)}`);
      }
    }

    expect(
      offenders,
      `these let an sr-only span escape to <body> and lengthen the page:\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });

  it("found some to check, so an empty pass cannot look like a clean one", () => {
    const checked = FILES.flatMap((path) =>
      statusRegions(readFileSync(join(process.cwd(), path), "utf8")).filter((region) =>
        region.body.includes('className="sr-only"'),
      ),
    );

    expect(checked.length, "no labelled loading indicators found — has the walk broken?").toBeGreaterThan(
      4,
    );
  });
});
