import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { AdminPageHeader } from "@/apps/admin/components";
import { SettingsSectionShell } from "@/apps/admin/settings/components/settings-section-shell";

/**
 * Ten settings screens explained themselves for about a tenth of a second.
 *
 * Every one of them was written this way:
 *
 *   description={
 *     hydration === "ready"
 *       ? `${configuredCount} of 4 integrations configured`
 *       : "Tracking IDs for analytics and marketing pixels."
 *   }
 *
 * The sentence saying what the page is FOR is the false branch — so it showed
 * only while the settings read was still in flight, and the moment the values
 * landed it was replaced, permanently, by a count. The one person who needed
 * that sentence is somebody opening the screen for the first time, and they
 * are exactly the person who never saw it: they arrive at "3 of 4 integrations
 * configured" with no idea what an integration is here or what putting a
 * fourth one in would do.
 *
 * Both belong on the page. The explanation stays put; the readout moved to its
 * own line under it.
 */

const DIR = "apps/admin/settings/components";
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

/** Every settings screen, found rather than listed, so a new one is covered. */
const SCREENS = readdirSync(join(process.cwd(), DIR)).filter((name) =>
  name.endsWith("-settings-page.tsx"),
);

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

function mount(component: unknown, props: Record<string, unknown>) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root!.render(createElement(component as never, props as never));
  });
  return container;
}

const render = (props: Record<string, unknown>) => mount(AdminPageHeader, props);

describe("the header shows what a page is for AND what it currently says", () => {
  it("renders both, as separate lines", () => {
    const text = render({
      title: "Analytics",
      description: "Where your visitor numbers come from.",
      status: "3 of 4 integrations configured",
    }).textContent;

    expect(text).toContain("Where your visitor numbers come from.");
    expect(text).toContain("3 of 4 integrations configured");
  });

  it("and a page with no readout yet still explains itself", () => {
    /**
     * The pre-hydration state, which is the whole point: before the settings
     * land there is nothing true to count, and that is precisely when someone
     * is reading the page to work out what it does.
     */
    const text = render({
      title: "Analytics",
      description: "Where your visitor numbers come from.",
      status: undefined,
    }).textContent;

    expect(text).toContain("Where your visitor numbers come from.");
    expect(text).not.toContain("undefined");
  });

  it("and the shell every settings screen is built on passes both through", () => {
    /**
     * The ten screens do not render the header themselves — they hand two
     * strings to `SettingsSectionShell`. A shell that quietly dropped one
     * would undo this everywhere at once while every source check above still
     * passed, because the pages would go on saying exactly the right thing.
     */
    const text = mount(SettingsSectionShell, {
      title: "Analytics",
      description: "Where your visitor numbers come from.",
      status: "3 of 4 integrations configured",
      isDirty: false,
      onSave: () => {},
      onDiscard: () => {},
      onReset: () => {},
      children: null,
    }).textContent;

    expect(text).toContain("Where your visitor numbers come from.");
    expect(text).toContain("3 of 4 integrations configured");
  });
});

describe("no settings screen spends its explanation on a value", () => {
  /**
   * The shape itself is the defect, so the shape is what is banned: a
   * `description` whose value is an expression choosing between a readout and
   * a sentence. Naming the ten strings instead would pass the moment an
   * eleventh screen was written the same way.
   */
  it("has screens to check in the first place", () => {
    // `it.each([])` is not a failure, so an enumeration that quietly came back
    // empty would report this whole block as passing.
    expect(SCREENS.length).toBeGreaterThan(10);
  });

  it.each(SCREENS)("%s states its description outright", (name) => {
    const source = read(join(DIR, name));
    const opener = source.match(/\n\s+description=(.)/);

    // Some screens pass no description at all; those are not this defect.
    if (!opener) return;
    expect(opener[1], name).toBe('"');
  });

  it.each(SCREENS)("%s keeps any readout in status", (name) => {
    // Comments stripped: one screen carries a paragraph of them inside the
    // gate, explaining which copy of the policy the readout is allowed to read.
    const source = code(join(DIR, name));
    if (!/\n\s+status=\{/.test(source)) return;

    /**
     * A readout is gated on the settings having arrived — that is what makes
     * it a readout. What matters is that the gate sits on `status` and the
     * explanation is not inside it.
     */
    const status = source.slice(source.indexOf("status={"));
    expect(status.slice(0, 200), name).toContain('hydration === "ready"');
  });
});

describe("the robots and sitemap screen stops saying nothing works", () => {
  const page = read(join(DIR, "seo-files-settings-page.tsx"));
  const overview = read(join(DIR, "settings-overview-page.tsx"));

  it("says the two files are already live, at the top", () => {
    /**
     * Both are generated per request and served now. The page said so in its
     * last and smallest line, under a "Coming soon" badge — so an owner
     * checking on search engines read four ways that nothing was working and
     * one way that everything was.
     */
    expect(page).toContain("Both are already live");
    expect(page).not.toContain("Control how search engines crawl and index your store");
  });

  it("stops listing things this page will never do", () => {
    // Submitting a sitemap happens at Google. Nothing in this CMS knows what a
    // staging site is. Neither was ever arriving here.
    expect(page).not.toContain("Submit the sitemap URL to search consoles");
    expect(page).not.toContain("Separate crawl rules for staging and live");
  });

  it("and the settings index says which half is pending", () => {
    // The row dims itself and wears the badge, so its one line has to carry
    // the correction: it is the editing that is unbuilt, not the crawling.
    expect(overview).toContain("Live already. Editing them by hand is not built yet.");
    expect(overview).not.toContain("Search-engine crawling and indexing — coming soon.");
  });
});
