import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Three screens where a box changed something real and said nothing about it.
 *
 * "Free delivery above" is the sharpest. Type 0 and every order ships free —
 * every order is at or above zero — so the delivery fee beside it is never
 * charged again. And the box directly underneath teaches the opposite lesson in
 * as many words: "Set to 0 to disable minimum order enforcement." Two inches
 * apart, one screen, and 0 means switch-this-off in one and switch-this-fully-on
 * in the other.
 *
 * "Sign out other devices" ended every other admin session on one unconfirmed
 * click — on a shop with staff, mid-shift — while the button beside it, which
 * only adds this device to the same list, stopped to ask.
 *
 * And "Site name" is the one required field on General. It said so only after
 * you had emptied it and pressed Save.
 */

const COMMERCE = "apps/admin/settings/components/commerce-settings-page.tsx";
const SECURITY = "apps/admin/settings/components/security-settings-page.tsx";
const GENERAL = "apps/admin/settings/components/general-settings-page.tsx";
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const code = (path: string) =>
  read(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

describe("zero says which way it points", () => {
  const commerce = code(COMMERCE);

  it("warns that a free-delivery threshold of zero frees every order", () => {
    expect(commerce).toContain("0 here means");
    expect(commerce).toContain("EVERY order is free");
    expect(commerce).toContain("the fee beside this box is then never");
  });

  it("says how to charge on every order instead, which is the likelier intent", () => {
    // Nobody types 0 here meaning "free for all". They type it meaning "off".
    expect(commerce).toContain("To charge on every order, set this above the largest");
  });

  it("stops printing free-above-zero as though it were a threshold", () => {
    /**
     * The header and the preview both rendered "free above ₹0" — a sentence
     * that reads as a rule in force and is in fact the rule switched fully on
     * for everybody.
     */
    expect(commerce).toContain('"Delivery free on every order"');
    expect(commerce).toContain('"Delivery is free on every order."');
    // The threshold wording survives, for when there IS one.
    expect(commerce).toContain("free above ${formatCurrency(saved.freeDeliveryThreshold)}");

    /**
     * The CONDITION, not just the sentence. Asserting the string alone passes
     * on a branch nothing can reach — which a mutation proved by replacing the
     * test with `true` and leaving the sentence sitting unreachable below it.
     */
    for (const guard of [
      "saved.freeDeliveryThreshold > 0",
      "settings.freeDeliveryThreshold > 0",
    ]) {
      expect(commerce, guard).toContain(guard);
    }
  });

  it("and the neighbouring box still says what its own zero does", () => {
    // The contrast is the point: the two zeroes mean opposite things, and now
    // both say which.
    expect(commerce).toContain("Set to 0 to disable minimum order enforcement");
  });
});

describe("ending other people's sessions asks first", () => {
  const security = code(SECURITY);

  it("no longer fires on the click itself", () => {
    expect(security).not.toContain("onClick={() => void handleLogoutAll()}");
    expect(security).toContain("onClick={() => setLogoutOthersOpen(true)}");
  });

  it("says who it signs out and who it does not", () => {
    expect(security).toContain("including your");
    expect(security).toContain("staff, mid-shift");
    expect(security).toContain("This");
    expect(security).toContain("device stays signed in");
  });

  it("keeps the confirm on the twin that also ends this session", () => {
    // The pair is only legible if both ask; the difference between them is
    // whether you are logged out too, not whether you are warned.
    expect(security).toContain("Sign out everywhere?");
    expect(security).toContain("Sign out the other devices?");
  });

  it("says what the login-attempt number counts, and per what", () => {
    /**
     * It said "Max login attempts" and nothing else — not per minute, not per
     * connection. A shop setting it to 3 locks its whole counter staff out on
     * one person's typo, because the count is per internet connection.
     */
    expect(security).toContain("Wrong passwords allowed per minute");
    expect(security).toContain("Counted per internet connection, not per person");
  });
});

describe("the one required field on General says so in advance", () => {
  const general = code(GENERAL);

  it("marks it on the label rather than in an error", () => {
    expect(general).toContain(">Site name (required)</Label>");
  });

  it("says where the three identity fields actually land", () => {
    /**
     * None of the three said where it shows up, and one of them is the sentence
     * Google prints under the shop in its results — which a shop would write
     * very differently if it knew.
     */
    expect(general).toContain("It shows in the browser tab, on invoices and");
    expect(general).toContain("One short line under your shop");
    expect(general).toContain("The sentence Google shows under your shop in its results");
  });
});
