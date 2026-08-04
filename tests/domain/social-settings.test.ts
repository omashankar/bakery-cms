/**
 * Social links — the widest untrusted-input surface in the settings.
 *
 * `href` was `z.string().trim()`: no scheme, no shape. The footer writes it into
 * an `<a href>` and the footer is on EVERY page of the storefront, so a
 * `javascript:` URL there is script execution site-wide rather than on one page.
 *
 * The rest of the section had the quieter kind of wrong: `platform` was free
 * text feeding an icon lookup, `label` could be empty (it is the anchor's only
 * accessible name), row ids came from `Date.now()` so two rows added in the same
 * millisecond became the same row, and turning every profile off made the footer
 * show the DEMO accounts instead of nothing.
 */
import { describe, expect, it } from "vitest";

import { socialSchema } from "@/features/settings/server/settings.validators";
import {
  createSocialLinkId,
  defaultSocialLinks,
  instagramHandleFromUrl,
  isSafeSocialUrl,
  planSettingsRepairs,
  socialPlatformOptions,
} from "@/features/settings/lib/settings-utils";
import { hasSocialGlyph, socialLetterMark } from "@/components/shared/social-mark";
import { SOCIAL_ICON_PATHS } from "@/components/shared/social-icon-paths";

function link(overrides: Record<string, unknown> = {}) {
  return {
    id: "social-1",
    platform: "Instagram",
    href: "https://instagram.com/sweetcrumb",
    label: "Instagram",
    isActive: true,
    ...overrides,
  };
}

describe("a social profile URL", () => {
  it("accepts a real profile link", () => {
    expect(isSafeSocialUrl("https://instagram.com/sweetcrumb")).toBe(true);
    expect(isSafeSocialUrl("http://facebook.com/sweetcrumb")).toBe(true);
    expect(isSafeSocialUrl("https://wa.me/919000000000")).toBe(true);
  });

  it("refuses anything that is not a link to a profile", () => {
    // This one is the whole point: the footer is on every storefront page.
    expect(isSafeSocialUrl("javascript:alert(document.cookie)")).toBe(false);
    expect(isSafeSocialUrl("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
    expect(isSafeSocialUrl("//evil.example/profile")).toBe(false);
    expect(isSafeSocialUrl("instagram.com/sweetcrumb")).toBe(false);

    // Empty is not "no link" — it is a row that renders an anchor to nowhere.
    // Removing the row, or deactivating it, is how you say "we are not on this".
    expect(isSafeSocialUrl("")).toBe(false);
    expect(isSafeSocialUrl("https://")).toBe(false);
  });
});

describe("the social section contract", () => {
  it("accepts the shipped defaults", () => {
    expect(socialSchema.safeParse(defaultSocialLinks).success).toBe(true);
  });

  it("rejects a href that would execute in the footer of every page", () => {
    expect(socialSchema.safeParse([link({ href: "javascript:alert(1)" })]).success).toBe(false);
    expect(socialSchema.safeParse([link({ href: "" })]).success).toBe(false);
  });

  it("allows an INACTIVE row to hold a bad URL, so the repair does not brick the section", () => {
    // `migrate()` repairs a stored `javascript:` row by deactivating it, keeping
    // the label so an admin can see what needs fixing. If the URL rule applied
    // to every row regardless, that repair would produce a document the
    // section's own write path rejects forever: one row the server hid, and the
    // whole section unsaveable.
    expect(
      socialSchema.safeParse([link({ href: "javascript:alert(1)", isActive: false })]).success
    ).toBe(true);
    expect(socialSchema.safeParse([link({ href: "", isActive: false })]).success).toBe(true);

    // Turning it back on still has to pass, so nothing unsafe reaches a visitor.
    expect(
      socialSchema.safeParse([link({ href: "javascript:alert(1)", isActive: true })]).success
    ).toBe(false);
  });

  it("rejects a platform the footer has no mark for", () => {
    for (const platform of socialPlatformOptions) {
      expect(socialSchema.safeParse([link({ platform })]).success).toBe(true);
    }
    expect(socialSchema.safeParse([link({ platform: "Orkut" })]).success).toBe(false);
  });

  it("requires a label, which is the anchor's only accessible name", () => {
    // The footer renders an icon and nothing else, so `aria-label={label}` is
    // the entire name a screen reader has for the link.
    expect(socialSchema.safeParse([link({ label: "" })]).success).toBe(false);
    expect(socialSchema.safeParse([link({ label: "   " })]).success).toBe(false);
  });

  it("accepts an empty list — turning every profile off is a real choice", () => {
    expect(socialSchema.safeParse([]).success).toBe(true);
  });
});

describe("the footer mark", () => {
  it("gives every offered platform something of its own to render", () => {
    // The whole point of replacing the old lookup: it mapped `Instagram: Share2`
    // and `Facebook: Globe` and covered four of the eight platforms, so five of
    // them rendered the SAME generic share arrow. Picking a platform changed the
    // label and nothing a visitor could see.
    const rendered = socialPlatformOptions.map((platform) =>
      hasSocialGlyph(platform) ? SOCIAL_ICON_PATHS[platform].path : socialLetterMark(platform)
    );
    expect(new Set(rendered).size).toBe(socialPlatformOptions.length);
  });

  it("has a real brand glyph for every platform the picker offers", () => {
    // No letter-mark fallbacks left among the supported platforms. If a
    // platform is added to the picker without an icon, this is what says so.
    const withoutGlyph = socialPlatformOptions.filter((p) => !hasSocialGlyph(p));
    expect(withoutGlyph).toEqual([]);
  });

  it("draws every glyph inside its OWN viewBox", () => {
    // The icons come from two packages with different coordinate spaces (24x24
    // and 16x16). Rendering one through the other's viewBox clips it or shrinks
    // it into a corner, so each path is checked against the box it declares.
    for (const [platform, icon] of Object.entries(SOCIAL_ICON_PATHS)) {
      const [, , width, height] = icon.viewBox.split(/\s+/).map(Number);
      expect(width, `${platform} viewBox`).toBeGreaterThan(0);

      const numbers = (icon.path.match(/-?\d*\.?\d+/g) ?? []).map(Number);
      expect(numbers.length, `${platform} has no coordinates`).toBeGreaterThan(4);
      // Generous bounds: path data carries control points and relative deltas,
      // so this catches a glyph drawn for the wrong box, not fine detail.
      const limit = Math.max(width, height) * 1.5;
      expect(Math.max(...numbers), `${platform} overflows its ${icon.viewBox} box`).toBeLessThanOrEqual(limit);
      expect(Math.min(...numbers), `${platform} falls outside its box`).toBeGreaterThanOrEqual(-limit);
    }
  });

  it("does not resolve a platform through the prototype chain", () => {
    // A plain-object lookup answers `constructor` and `toString` with functions,
    // and this field was free text for the life of the project — so a document
    // written before the enum can carry exactly those.
    for (const nasty of ["constructor", "toString", "hasOwnProperty", "__proto__"]) {
      expect(hasSocialGlyph(nasty)).toBe(false);
      expect(typeof socialLetterMark(nasty)).toBe("string");
    }
    expect(socialLetterMark("")).toBe("?");
  });
});

describe("repairing what is already in Mongo", () => {
  it("hides an active row whose href would execute, and keeps the rest", () => {
    const repairs = planSettingsRepairs({
      social: [
        { href: "javascript:alert(1)", isActive: true },
        { href: "https://facebook.com/shop", isActive: true },
        { href: "", isActive: true },
      ],
    });

    expect(repairs.map((r) => r.path)).toEqual(["social.0.isActive", "social.2.isActive"]);
    expect(repairs.every((r) => r.value === false)).toBe(true);
  });

  it("leaves an already-hidden row alone, so a read does not churn the document", () => {
    // It is rendered nowhere, so there is nothing to repair — and rewriting it
    // would mean a save on every single settings read.
    expect(planSettingsRepairs({ social: [{ href: "javascript:alert(1)", isActive: false }] }))
      .toEqual([]);
  });

  it("is idempotent — a repaired document plans nothing on the next read", () => {
    const settings = {
      contact: { mapEmbedUrl: '<iframe src="https://maps.example/x?a=1&amp;b=2"></iframe>' },
      social: [{ href: "javascript:alert(1)", isActive: true }],
    };

    const first = planSettingsRepairs(settings);
    expect(first).toHaveLength(2);

    // Apply them, the way the repository does, then re-plan.
    const applied = {
      contact: { mapEmbedUrl: first[0].value as string },
      social: [{ href: settings.social[0].href, isActive: first[1].value as boolean }],
    };
    expect(planSettingsRepairs(applied)).toEqual([]);
    expect(applied.contact.mapEmbedUrl).toBe("https://maps.example/x?a=1&b=2");
  });

  it("plans nothing for a document that was always valid", () => {
    expect(
      planSettingsRepairs({
        contact: { mapEmbedUrl: "https://www.google.com/maps/embed?pb=1" },
        social: defaultSocialLinks,
      })
    ).toEqual([]);
  });

  it("leaves a repaired document acceptable to the schema", () => {
    // The trap this avoids: repairing by DEACTIVATING keeps the bad href at
    // rest, so if the URL rule applied to every row the section would become
    // permanently unsaveable.
    const rows = [link({ href: "javascript:alert(1)", isActive: true })];
    const repairs = planSettingsRepairs({ social: rows });
    const repaired = rows.map((row) => ({ ...row, isActive: repairs.length ? false : row.isActive }));

    expect(socialSchema.safeParse(repaired).success).toBe(true);
  });
});

describe("the handle behind an Instagram URL", () => {
  it("reads the account name out of a profile link", () => {
    expect(instagramHandleFromUrl("https://instagram.com/sweetcrumb")).toBe("sweetcrumb");
    expect(instagramHandleFromUrl("https://www.instagram.com/sweetcrumb/")).toBe("sweetcrumb");
    expect(instagramHandleFromUrl("http://instagram.com/@sweetcrumb")).toBe("sweetcrumb");
    expect(instagramHandleFromUrl("https://instagram.com/sweetcrumb?hl=en")).toBe("sweetcrumb");
  });

  it("returns nothing for a URL that names no account", () => {
    // The bare domain is the shipped placeholder. Treating it as a configured
    // profile is exactly what left the homepage advertising the demo account.
    expect(instagramHandleFromUrl("https://instagram.com")).toBe("");
    expect(instagramHandleFromUrl("https://instagram.com/")).toBe("");
    // Instagram's own routes are not accounts.
    expect(instagramHandleFromUrl("https://instagram.com/p/Cabc123")).toBe("");
    expect(instagramHandleFromUrl("https://instagram.com/explore/tags/cake")).toBe("");
    // A different site never yields a handle.
    expect(instagramHandleFromUrl("https://facebook.com/sweetcrumb")).toBe("");
    expect(instagramHandleFromUrl("")).toBe("");
  });
});

describe("row identity", () => {
  it("gives every new row its own id, even back to back", () => {
    // `social-${Date.now()}` collided when "Add link" was clicked twice quickly:
    // `updateLink` matches on the id, so editing one row edited both, and they
    // collided as React keys too.
    const ids = new Set(Array.from({ length: 500 }, () => createSocialLinkId()));
    expect(ids.size).toBe(500);
  });

  it("keeps the shipped defaults distinct", () => {
    const ids = new Set(defaultSocialLinks.map((item) => item.id));
    expect(ids.size).toBe(defaultSocialLinks.length);
  });
});
