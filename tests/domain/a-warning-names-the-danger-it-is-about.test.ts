import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { readableStrings } from "./no-new-bakery-wording.test";

/**
 * Three screens describing themselves as something they are not, and the guard
 * that could not see one of them.
 *
 * The custom-code box warned about the small danger and stayed quiet about the
 * large one. "Invalid code can break your storefront" — true, and a broken
 * style shows up at once and is undone at once. What it did not say is that
 * anything pasted there RUNS in every visitor's browser, on every page, with
 * the run of whatever they type. A shop pasting a snippet from a stranger is
 * exactly the case that box exists to speak to. And it closed with "stored now
 * and applied when the backend renders it" — a sentence about this system's
 * internals that reads as "not live yet", on the screen where believing that
 * costs most.
 *
 * The activity log called a permanent record "this demo CMS" — the one screen
 * whose whole value is that a shop can trust what it says happened.
 *
 * And the contact screen said "reach your bakery" in a CMS sold to any trade,
 * where the wording ratchet was structurally unable to see it: the sentence sat
 * on the same line as its tags, which neither of the guard's two readers
 * looked at. Closing that hole immediately found a second one nobody knew
 * about.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

describe("the custom-code warning is about the real risk", () => {
  const page = code("apps/admin/settings/components/custom-code-settings-page.tsx");

  it("says where the code runs, and on whom", () => {
    expect(page).toContain("runs on your live shop, in every visitor");
    expect(page).toContain("on every page");
  });

  it("says the thing a pasted snippet can actually do", () => {
    // Breaking the storefront is visible and undoable. Reading what a customer
    // types is neither.
    expect(page).toContain("leak what");
    expect(page).toContain("customers type");
  });

  it("stops reading as though nothing were live yet", () => {
    expect(page).not.toContain("applied when the");
    expect(page).not.toContain("backend renders it");
    expect(page).toContain("Saving publishes it straight away");
  });
});

describe("the activity log is a record, not a demo", () => {
  it("says what it is kept for", () => {
    const page = code("apps/admin/settings/components/activity-settings-page.tsx");

    expect(page).not.toContain("in this demo CMS");
    expect(page).toContain("Who changed what, and when");
  });
});

describe("the wording ratchet reads text that shares a line with its tags", () => {
  it("sees a sentence written inline", () => {
    /**
     * The shape that hid for as long as the guard has existed. The
     * quoted-string reader finds no quotes; the bare-prose reader needs the
     * line to OPEN with a letter, and this opens with "<".
     */
    const line = '            <CardDescription>Primary ways customers can reach your bakery.</CardDescription>';

    expect(readableStrings(line)).toContain("Primary ways customers can reach your bakery.");
  });

  it("reads every sentence on the line, not only the first", () => {
    /**
     * Two short siblings fit on one line, and the formatter leaves them there.
     * A reader that stopped at the first match would let the second sentence
     * through for exactly as long as it sat beside a shorter one — a hole the
     * shape of the one just closed.
     */
    const line =
      "      <CardTitle>Our cakes</CardTitle><CardDescription>Baked to order.</CardDescription>";

    expect(readableStrings(line)).toEqual(["Our cakes", "Baked to order."]);
  });

  it("and still ignores the code around it", () => {
    // The branch is bounded the same way the bare-prose one is: text carrying
    // the punctuation an expression needs is code, not words.
    for (const line of [
      "        <Button onClick={() => bakeCake()}>Save</Button>",
      '        <p className="text-sm">{cake.name}</p>',
      "        const label = `${cakes.length} cakes`;",
    ]) {
      expect(readableStrings(line), line).toEqual([]);
    }
  });

  it("found one nobody knew about the moment it could see", () => {
    /**
     * "Most ordered cakes" had been sitting on the customer detail screen,
     * inline, invisible to the ratchet. A guard's first catch after being
     * widened is the measure of what it was missing.
     */
    const customers = read("apps/admin/commerce/pages/customer-detail-page.tsx");

    expect(customers).not.toContain("Most ordered cakes");
    expect(customers).toContain("What this customer orders most");
  });

  it("and the contact screen stops naming a trade", () => {
    // Comments stripped: the tombstone recording the removal names the very
    // string it records, which is how a guard fails on its own explanation.
    const contact = code("apps/admin/settings/components/contact-settings-page.tsx");

    expect(contact).not.toContain("reach your bakery");
    expect(contact).toContain("Where customers reach you");
  });
});
