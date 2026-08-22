import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { businessHours as shippedHours, contactInfo } from "@/constants/landing-data";
import { chosen } from "@/apps/website/lib/shipped-placeholder";

/**
 * A phone number the shop does not have is worse than no phone number.
 *
 * Settings → Contact is never empty — the singleton is CREATED from
 * `defaultContactSettings`, which is the demo "123 Baker Street, Mumbai" and a
 * demo 1800 number — and every read did `contact.phone || defaultContact.phone`.
 * `contactSchema` stores a cleared field as `""`, which is falsy, so an admin
 * who deleted the number got the demo one back, and the contact and FAQ pages
 * turned it into a live `tel:` link. The footer did the same with the address,
 * on every storefront page.
 *
 * The map field directly above them in the same file had already been fixed for
 * exactly this ("An admin who CLEARS the field means 'no map' … Empty now stays
 * empty") and its three siblings on the next three lines were left alone; so had
 * the social block ten lines below the footer's copy, whose comment says
 * answering "no social" with instagram.com "pointed visitors at accounts the
 * shop does not own".
 */
describe("telling a chosen value from a shipped one", () => {
  it("treats a cleared field as cleared", () => {
    expect(chosen("", "placeholder")).toBe("");
    expect(chosen("   ", "placeholder")).toBe("");
    expect(chosen(undefined, "placeholder")).toBe("");
  });

  it("treats the shipped placeholder as never set", () => {
    // Literals, NOT `contactInfo.*`. Those constants are blank now, so deriving
    // the inputs from them made all three assertions `chosen("", "")` — true
    // via the empty-string branch, and identical to the test above. The
    // placeholder-equality clause could then be deleted outright and this suite
    // would stay green. A test must not take its subject from the thing it is
    // pinning.
    expect(chosen("+91 98765 00000", "+91 98765 00000")).toBe("");
    expect(chosen("7 Somewhere Road, Jaipur", "7 Somewhere Road, Jaipur")).toBe("");
    expect(chosen("  7 Somewhere Road, Jaipur  ", "7 Somewhere Road, Jaipur")).toBe("");
  });

  it("still rejects the values this install used to ship, now that the seed is blank", () => {
    // The seed was emptied so a fresh install publishes nothing. That also
    // removed what `chosen()` compared against, so a shop still holding the old
    // un-edited values would have started publishing them. `chosen` carries
    // them as an explicit reject list; these pin that it does.
    expect(chosen("123 Baker Street, Mumbai, Maharashtra 400001", "")).toBe("");
    expect(chosen("+91 1800-123-4567", "")).toBe("");
    expect(chosen("  +91 1800-123-4567  ", "")).toBe("");
  });

  it("the shipped contact seed is blank, so a fresh install publishes nothing", () => {
    // Pinned separately from the rule above. Previously one property hid the
    // other: the seed being blank was what made the placeholder rule untestable.
    expect(contactInfo.address).toBe("");
    expect(contactInfo.phone).toBe("");
    expect(contactInfo.email).toBe("");
    expect(contactInfo.mapEmbedUrl).toBe("");
  });

  it("keeps what the shop actually typed", () => {
    // Non-empty placeholders, so this exercises the "differs from shipped"
    // branch rather than passing on the placeholder simply being blank.
    expect(chosen("+91 98765 43210", "+91 98765 00000")).toBe("+91 98765 43210");
    expect(chosen("  9 Real Street, Delhi ", "7 Somewhere Road, Jaipur")).toBe("9 Real Street, Delhi");
  });
});

const settings = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock("@/features/settings/server/settings.service", () => ({
  getSettings: vi.fn(async () => settings.value),
}));
vi.mock("@/features/site-layout/server/site-layout.service", () => ({
  getSiteLayout: vi.fn(async () => ({})),
}));

import { getStorefrontContact } from "@/apps/website/lib/storefront-contact.server";
import { getStorefrontChrome } from "@/apps/website/lib/storefront-chrome.server";

describe("what the storefront publishes as the shop's contact details", () => {
  beforeEach(() => {
    settings.value = {};
  });

  it("publishes nothing where the admin cleared the field", async () => {
    settings.value = { contact: { address: "", phone: "", email: "" } };

    const contact = await getStorefrontContact();

    expect(contact.address).toBe("");
    expect(contact.phone).toBe("");
    expect(contact.email).toBe("");
  });

  it("does not publish the demo details of a shop that never opened Settings", async () => {
    settings.value = {
      contact: {
        address: contactInfo.address,
        phone: contactInfo.phone,
        email: contactInfo.email,
      },
    };

    const contact = await getStorefrontContact();

    expect(contact.phone).toBe("");
    expect(contact.address).toBe("");
  });

  it("publishes what the shop really set", async () => {
    settings.value = {
      contact: { address: "9 Real Street, Delhi", phone: "+91 98765 43210", email: "hi@real.in" },
    };

    const contact = await getStorefrontContact();

    expect(contact.address).toBe("9 Real Street, Delhi");
    expect(contact.phone).toBe("+91 98765 43210");
    expect(contact.email).toBe("hi@real.in");
  });

  it("applies the same rule to the footer on every page", async () => {
    settings.value = { contact: { address: "", phone: "", email: "" } };

    const chrome = await getStorefrontChrome();

    expect(chrome.contact).toEqual({ address: "", phone: "", email: "" });
  });

  /**
   * Opening hours, the fourth sibling on the same four lines.
   *
   * `businessHours?.length ? … : defaultHours` published "Monday – Saturday,
   * 9:00 AM – 9:00 PM" under a heading reading "Opening Hours". Unlike a wrong
   * phone number, a customer can act on this one without contacting anybody:
   * they turn up at 8pm and the door is locked.
   */
  it("does not invent opening hours for a shop that has none", async () => {
    settings.value = { contact: { businessHours: [] } };

    expect((await getStorefrontContact()).businessHours).toEqual([]);
  });

  it("does not publish the shipped hours of a shop that never opened Settings", async () => {
    settings.value = { contact: { businessHours: [...shippedHours] } };

    expect((await getStorefrontContact()).businessHours).toEqual([]);
  });

  it("publishes the hours the shop really set", async () => {
    const real = [{ day: "Tue – Sun", hours: "7:00 AM – 7:00 PM" }];
    settings.value = { contact: { businessHours: real } };

    expect((await getStorefrontContact()).businessHours).toEqual(real);
  });

  it("applies the same rule to the footer, which shows hours on every page", async () => {
    settings.value = { contact: { businessHours: [...shippedHours] } };

    expect((await getStorefrontChrome()).businessHours).toEqual([]);
  });

  it("still falls back when the DATABASE is unreachable, which is a different thing", async () => {
    // Not "the shop publishes nothing" — "we do not know what the shop
    // publishes". The generic chrome is the right answer there.
    const service = await import("@/features/settings/server/settings.service");
    vi.mocked(service.getSettings).mockRejectedValueOnce(new Error("db down"));

    const contact = await getStorefrontContact();

    expect(contact.phone).toBe(contactInfo.phone);
  });
});

/**
 * The read telling the truth means a blank now reaches the render, so an
 * unguarded anchor is `tel:` pointing at nothing and an unguarded row is an
 * icon with empty space beside it.
 */
describe("the pages that render them", () => {
  const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

  it("does not build a tel: or mailto: link out of a blank", () => {
    for (const path of ["apps/website/pages/contact-page.tsx", "apps/website/pages/faq-page.tsx"]) {
      const page = source(path);
      const tel = page.indexOf("href={`tel:");
      const mailto = page.indexOf("href={`mailto:");

      // Each anchor sits inside a `contactInfo.phone ? … : null` guard, so the
      // conditional appears before it.
      expect(page.slice(0, tel), `${path} renders tel: unguarded`).toContain(
        "{contactInfo.phone ? (",
      );
      expect(page.slice(0, mailto), `${path} renders mailto: unguarded`).toContain(
        "{contactInfo.email ? (",
      );
    }
  });

  it("drops the footer's Contact column when the shop publishes none of the three", () => {
    const footer = source("apps/website/landing/components/landing-footer.tsx");

    expect(footer).toContain(
      "(contactInfo.address || contactInfo.phone || contactInfo.email)",
    );
    expect(footer).toContain("{contactInfo.address ? (");
    expect(footer).toContain("{contactInfo.phone ? (");
    expect(footer).toContain("{contactInfo.email ? (");
  });

  it("keeps the map URL checked on the client too, not only on the server", () => {
    const client = source("apps/website/lib/settings.ts");

    // It fed an `<iframe src>` straight from a field that was free text for the
    // life of the project.
    expect(client).toContain("normalizeMapEmbedUrl");
    expect(client).toContain("isValidMapEmbedUrl");
    expect(client).not.toContain("contact.mapEmbedUrl || contactInfo.mapEmbedUrl");
  });
});
