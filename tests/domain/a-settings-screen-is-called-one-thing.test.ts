import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A screen shows its name on four surfaces, and six of them disagreed.
 *
 * The index row said "Contact Information", the page heading said "Contact".
 * The row said "Order Settings", the heading said "Commerce" — which is also
 * the GROUP heading three rows above it, so the page you landed on appeared to
 * be the group you had just left. Six rows in all, and a shop owner clicking
 * one had no way to tell whether the page that opened was the page they asked
 * for.
 *
 * And one row promised three screens and opened one. "Delivery zones, time
 * slots, and shipping rules" linked to zones only — while no other menu in the
 * CMS reaches the other two, so a shop looking for its delivery times arrived
 * at a list of areas with nowhere else to go.
 *
 * The rule this file holds: a row is named after the heading it opens. The
 * plain-language half goes in the description, where it cannot contradict
 * anything.
 */

const OVERVIEW = "apps/admin/settings/components/settings-overview-page.tsx";
const SHELL = "apps/admin/settings/components/settings-section-shell.tsx";
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

/** The `title="…"` a settings screen renders as its own h1. */
const headingOf = (screen: string) =>
  code(`apps/admin/settings/components/${screen}-settings-page.tsx`).match(/title="([^"]+)"/)?.[1];

describe("a screen answers to one name", () => {
  const overview = code(OVERVIEW);

  it("gives the page the heading its row promised", () => {
    /**
     * Checked against the index rather than against a list retyped here: two
     * copies of the same name is how they came apart in the first place.
     */
    for (const [screen, row] of [
      ["commerce", "Order Settings"],
      ["contact", "Contact Information"],
      ["social", "Social Media"],
      ["maintenance", "Maintenance Mode"],
      ["security", "Login Security"],
    ] as const) {
      expect(headingOf(screen), `${screen}'s own heading`).toBe(row);
      expect(overview, `${screen} is not on the index`).toContain(`title: "${row}"`);
    }
  });

  it("stops a page sharing its name with the group it sits under", () => {
    /**
     * "Commerce" was both the group heading and the page you landed on from
     * inside it, and "Security" was both the group heading and its own screen.
     * Arriving somewhere apparently named after the place you left is worse
     * than arriving somewhere unnamed.
     */
    expect(headingOf("commerce")).not.toBe("Commerce");
    expect(headingOf("security")).not.toBe("Security");
    // The groups keep their names — it is the pages that moved.
    expect(overview).toContain('title: "Commerce"');
    expect(overview).toContain('title: "Security"');
  });

  it("and the activity row matches the page it opens", () => {
    expect(overview).toContain('title: "Activity Log"');
    expect(overview).not.toContain('title: "Activity Logs"');
  });
});

describe("a row opens what it names", () => {
  const overview = code(OVERVIEW);

  it("stops promising three delivery screens behind one link", () => {
    expect(overview).not.toContain("Delivery zones, time slots, and shipping rules");
  });

  it("gives each of the three its own row, reachable at last", () => {
    for (const [title, route] of [
      ["Delivery Zones", "routes.admin.commerce.deliveryZones"],
      ["Delivery Slots", "routes.admin.commerce.deliverySlots"],
      ["Shipping Rules", "routes.admin.commerce.shippingRules"],
    ] as const) {
      expect(overview, title).toContain(`title: "${title}"`);
      expect(overview, route).toContain(`href: ${route},`);
    }
  });
});

describe("the button that overwrites a page stops leading the row", () => {
  const shell = code(SHELL);

  it("puts Reset last, after Save", () => {
    /**
     * It led the action row and was the full-width control on a phone. On a
     * screen nobody has touched yet Save is disabled and Discard is absent — so
     * the one prominent enabled button on the page was the one that overwrites
     * it, which is exactly the button a first-timer presses to find out what it
     * does.
     */
    const reset = shell.indexOf("setResetOpen(true)");
    const save = shell.indexOf("onClick={onSave}");

    expect(save).toBeGreaterThan(0);
    expect(reset).toBeGreaterThan(save);
  });

  it("and stops dressing it as a primary control", () => {
    const at = shell.indexOf("setResetOpen(true)");
    const button = shell.slice(shell.lastIndexOf("<Button", at), at);

    expect(button).toContain('variant="ghost"');
    expect(button).not.toContain('variant="outline"');
  });

  it("says what pressing it does, in a consequence and not a category", () => {
    /**
     * "Replace this section with the demo defaults" — "section" is this file's
     * word for a screen and "demo defaults" is what the values are called in
     * the code. Neither says the two things that matter: it saves straight
     * away, and visitors see it at once.
     */
    expect(shell).not.toContain("Replace this section with the demo defaults");
    expect(shell).toContain("it saves straight away — there is no undo");
    expect(shell).toContain("visitors see the change at once");
    expect(shell).toContain("Nothing on the other settings pages changes");
  });

  it("names the confirm button after the act, not the category", () => {
    expect(shell).toContain("Replace these settings");
    expect(shell).not.toContain(">Reset defaults<");
  });
});
