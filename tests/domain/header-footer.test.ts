/**
 * The Header and Footer settings screens.
 *
 * Both stores had the shape the appearance store carried until two commits ago:
 * a local write that was never undone when the server refused, and a reset that
 * wiped to the demo seed before asking. And both screens offered controls that
 * reached no customer at all.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultHeaderSettings } from "@/features/site-layout/lib/header-utils";
import { defaultFooterSettings } from "@/features/site-layout/lib/footer-utils";

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock("@/features/settings/server/settings.service");
  vi.doUnmock("@/features/site-layout/server/site-layout.service");
});

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

/** The file with comments stripped — a comment quoting the old code is not the code. */
function code(relativePath: string): string {
  return source(relativePath)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

async function openGate() {
  const { siteLayoutHydration } = await import("@/features/site-layout/lib/site-layout-api");
  siteLayoutHydration.markSettled();
}

describe("a refused write", () => {
  it("is rolled back out of the header cache", async () => {
    const store = await import("@/features/site-layout/lib/header-repository");
    await openGate();

    const real = { ...defaultHeaderSettings, logoLetter: "Z" };
    localStorage.setItem("bakery-cms-header", JSON.stringify(real));
    vi.stubGlobal("fetch", async () => new Response(null, { status: 401 }));

    const result = await store.saveHeaderSettings({
      ...defaultHeaderSettings,
      logoLetter: "Q",
    });

    expect(result.persisted).toBe(false);
    // Nothing put this right otherwise: `ensureSiteLayoutHydrated` short-circuits
    // on a settled gate, so the rejected value survived the session and a remount
    // adopted it as the SAVED one — the screen presenting it as saved.
    expect(JSON.parse(localStorage.getItem("bakery-cms-header") ?? "{}").logoLetter).toBe("Z");
  });

  it("is rolled back out of the footer cache", async () => {
    const store = await import("@/features/site-layout/lib/footer-repository");
    await openGate();

    localStorage.setItem(
      "bakery-cms-footer",
      JSON.stringify({ ...defaultFooterSettings, copyrightSuffix: "real" }),
    );
    vi.stubGlobal("fetch", async () => new Response(null, { status: 401 }));

    const result = await store.saveFooterSettings({
      ...defaultFooterSettings,
      copyrightSuffix: "rejected",
    });

    expect(result.persisted).toBe(false);
    expect(JSON.parse(localStorage.getItem("bakery-cms-footer") ?? "{}").copyrightSuffix).toBe(
      "real",
    );
  });

  it("leaves a concurrent write the server DID accept alone", async () => {
    const store = await import("@/features/site-layout/lib/header-repository");
    await openGate();

    localStorage.setItem(
      "bakery-cms-header",
      JSON.stringify({ ...defaultHeaderSettings, logoLetter: "Z" }),
    );
    vi.stubGlobal("fetch", async () => {
      localStorage.setItem(
        "bakery-cms-header",
        JSON.stringify({ ...defaultHeaderSettings, logoLetter: "W" }),
      );
      return new Response(null, { status: 401 });
    });

    await store.saveHeaderSettings({ ...defaultHeaderSettings, logoLetter: "Q" });

    // Restoring the entry snapshot unconditionally would undo a good write.
    expect(JSON.parse(localStorage.getItem("bakery-cms-header") ?? "{}").logoLetter).toBe("W");
  });
});

describe("a refused reset", () => {
  it("does not replace the shop's header with the demo seed", async () => {
    const store = await import("@/features/site-layout/lib/header-repository");
    await openGate();

    localStorage.setItem(
      "bakery-cms-header",
      JSON.stringify({ ...defaultHeaderSettings, logoLetter: "Z" }),
    );
    vi.stubGlobal("fetch", async () => new Response(null, { status: 401 }));

    const result = await store.resetHeaderSettings();

    // `runWrite` commits the returned value as the working copy regardless of
    // acceptance, so returning the defaults here left the editor showing the
    // demo seed with the shop's real nav gone from this browser — and the next
    // accepted save published that seed to the database.
    expect(result.persisted).toBe(false);
    expect(result.value.logoLetter).toBe("Z");
    expect(JSON.parse(localStorage.getItem("bakery-cms-header") ?? "{}").logoLetter).toBe("Z");
  });

  it("does not replace the shop's footer with the demo seed", async () => {
    const store = await import("@/features/site-layout/lib/footer-repository");
    await openGate();

    localStorage.setItem(
      "bakery-cms-footer",
      JSON.stringify({ ...defaultFooterSettings, copyrightSuffix: "real" }),
    );
    vi.stubGlobal("fetch", async () => new Response(null, { status: 401 }));

    const result = await store.resetFooterSettings();

    expect(result.persisted).toBe(false);
    expect(result.value.copyrightSuffix).toBe("real");
  });
});

describe("an empty list is an answer", () => {
  it("does not put the demo nav back when the shop deleted every row", async () => {
    const store = await import("@/features/site-layout/lib/header-repository");
    localStorage.setItem(
      "bakery-cms-header",
      JSON.stringify({ ...defaultHeaderSettings, nav: [] }),
    );

    // `parsed.nav?.length ? parsed.nav : defaults.nav` could not tell "never set
    // up" from "set up, and the answer is none". The server keeps the empty
    // list, so the editor showed demo rows the database did not have — and the
    // next save published them.
    expect(store.loadHeaderSettings().nav).toEqual([]);
  });

  it("does not put the demo columns back when the shop deleted every one", async () => {
    const store = await import("@/features/site-layout/lib/footer-repository");
    localStorage.setItem(
      "bakery-cms-footer",
      JSON.stringify({ ...defaultFooterSettings, columns: [] }),
    );

    expect(store.loadFooterSettings().columns).toEqual([]);
  });

  it("still falls back when the field is genuinely absent", async () => {
    const store = await import("@/features/site-layout/lib/header-repository");
    localStorage.setItem("bakery-cms-header", JSON.stringify({ logoLetter: "Z" }));

    expect(store.loadHeaderSettings().nav.length).toBeGreaterThan(0);
  });
});

describe("what the server accepts", () => {
  it("keeps the two nav fields the storefront actually reads", async () => {
    const { siteLayoutSchemas } = await import(
      "@/features/site-layout/server/site-layout.validators"
    );

    // `selectVisibleNavItems` filters on `isVisible` and sorts on `sortOrder`,
    // and neither was in the schema — so a restored nav without them rendered
    // ZERO links for the customer while the admin's merged view showed them all.
    const parsed = siteLayoutSchemas.header.parse({
      logoLetter: "M",
      nav: [{ id: "n1", label: "Home", href: "/store" }],
    });

    expect(parsed.nav[0].isVisible).toBe(true);
    expect(parsed.nav[0].sortOrder).toBe(0);
  });

  it("gives every footer column a links array", async () => {
    const { siteLayoutSchemas } = await import(
      "@/features/site-layout/server/site-layout.validators"
    );

    // `landing-footer` does `column.links.map(...)` unguarded, INSIDE the
    // storefront shell and outside the chrome loader's try/catch — so a column
    // stored without links threw on every storefront route, and the admin's own
    // footer screen died on the same value.
    const parsed = siteLayoutSchemas.footer.parse({
      columns: [{ id: "c1", title: "Quick Links" }],
      copyrightSuffix: "",
    });

    expect(parsed.columns[0].links).toEqual([]);
  });

  it("defends the same shape at READ time, for rows stored before the rule", async () => {
    vi.doMock("@/features/settings/server/settings.service", () => ({
      getSettings: async () => ({ general: {}, contact: {}, social: [] }),
    }));
    vi.doMock("@/features/site-layout/server/site-layout.service", () => ({
      getSiteLayout: async (key: string) =>
        key === "footer"
          ? { columns: [{ id: "c1", title: "Legacy" }], copyrightSuffix: "" }
          : {},
    }));

    const { getStorefrontChrome } = await import("@/apps/website/lib/storefront-chrome.server");
    const chrome = await getStorefrontChrome();

    // A schema only constrains future writes; this is the row already at rest.
    expect(chrome.footer.columns[0].links).toEqual([]);
  });
});

describe("controls that reached no customer", () => {
  it("carries the header CTA through to the navbar", () => {
    // A switch, a label and a link, stored and validated and summarised on the
    // screen — and rendered nowhere. The card's own helper text said "Order
    // inquiry button on desktop".
    const chrome = code("apps/website/lib/storefront-chrome.server.ts");
    expect(chrome).toMatch(/cta: \{ show: boolean; label: string; href: string \}/);
    expect(chrome).toContain("header.showCta ?? defaultHeaderSettings.showCta");

    const navbar = code("apps/website/components/storefront-navbar.tsx");
    expect(navbar).toContain("chrome.cta");
    expect(navbar).toMatch(/\{cta\.show \? \(/);
    expect(navbar).toContain("{cta.label}");
  });

  it("drives the Collections row's own label and visibility", () => {
    const navbar = code("apps/website/components/storefront-navbar.tsx");
    // Both rows were filtered out and their substitutes hardcoded, so their
    // switch, label and reorder buttons changed nothing a customer saw.
    expect(navbar).toContain(
      "const collectionsRow = navItems.find((item) => item.href === routes.store.collections)",
    );
    expect(navbar).toMatch(/\{collectionsRow \? \(/);
    // Per element, not once for the file: the desktop menu and the mobile list
    // both take that same prop, so a single `toContain` passed with either one
    // deleted.
    const desktop = navbar.slice(navbar.indexOf("<MegaMenu"));
    expect(desktop.slice(0, desktop.indexOf("/>"))).toContain("label={collectionsRow.label}");

    const mobile = navbar.slice(navbar.indexOf("<MobileShopLinks"));
    expect(mobile.slice(0, mobile.indexOf("/>"))).toContain("label={collectionsRow.label}");

    const mega = code("components/storefront/mega-menu.tsx");
    expect(mega).toContain("{label}");
    expect(mega).not.toMatch(/^\s*Shop$/m);
  });

  it("drives the mobile Home row from its own row", () => {
    const navbar = code("apps/website/components/storefront-navbar.tsx");
    expect(navbar).toContain(
      "const homeRow = navItems.find((item) => item.href === routes.store.home)",
    );
    expect(navbar).toMatch(/\{homeRow \? \(/);
    expect(navbar).toContain("{homeRow.label}");
  });

  it("lets the Show map switch actually hide the map", () => {
    const contact = code("apps/website/pages/contact-page.tsx");
    // It was stored, counted in the footer screen's "N/4 sections on" line, and
    // read by nothing — the only map on the site gated on the URL alone.
    expect(contact).toContain("showMap && contactInfo.mapEmbedUrl");

    const route = code("app/(storefront)/store/contact/page.tsx");
    expect(route).toContain("showMap={chrome.footer.showMap}");
  });
});

describe("what these screens say after a refusal", () => {
  it("does not call a rolled-back write saved-on-this-device", () => {
    for (const page of [
      "apps/admin/header/components/header-admin-page.tsx",
      "apps/admin/footer/components/footer-admin-page.tsx",
    ]) {
      const rendered = code(page);
      // The default copy is "saved on this device only", which is wrong once
      // the store rolls back: the change is nowhere.
      expect(rendered).toMatch(/failure: "\w+ was not saved/);
      expect(rendered).toMatch(/failure: "\w+ was not reset/);
    }
  });

  it("says why Reset did nothing, instead of nothing", () => {
    for (const page of [
      "apps/admin/header/components/header-admin-page.tsx",
      "apps/admin/footer/components/footer-admin-page.tsx",
    ]) {
      const rendered = code(page);
      expect(rendered).toContain("hasn't loaded yet");
      expect(rendered).not.toMatch(/async function handleReset\(\) \{\s*\r?\n\s*if \(!canSave\) return;/);
    }
  });
});

/**
 * A shop's logo is usually its NAME, drawn — a wide wordmark, not a square icon.
 */
describe("the navbar logo", () => {
  /**
   * The logo ternary cut into three, and the third piece is the point.
   *
   * A first version of this sliced only "logo branch" and "everything after the
   * else", which put the code AFTER the closed ternary inside the fallback
   * slice — exactly where the unconditional name used to sit. Both assertions
   * then passed against the very layout they were written to reject. The
   * `afterTernary` slice is what makes "rendered in both branches" detectable.
   */
  function logoBranches() {
    const navbar = code("apps/website/components/storefront-navbar.tsx");
    const start = navbar.indexOf("{logo && !logoBroken ? (");
    expect(start, "the logo branch moved — this test is scoped to it").toBeGreaterThan(-1);
    const elseAt = navbar.indexOf(") : (", start);
    expect(elseAt, "the logo ternary has no fallback branch").toBeGreaterThan(start);
    const closeAt = navbar.indexOf(")}", elseAt);
    expect(closeAt, "the logo ternary never closes").toBeGreaterThan(elseAt);
    const end = navbar.indexOf("</Link>", closeAt);
    expect(end, "the brand link never closes").toBeGreaterThan(closeAt);
    return {
      withLogo: navbar.slice(start, elseAt),
      withoutLogo: navbar.slice(elseAt, closeAt),
      afterTernary: navbar.slice(closeAt, end),
    };
  }

  it("gives a wordmark its own width instead of crushing it into a square", () => {
    // `size-9` is 36×36. A 2:1 wordmark rendered into it came out 36×18 and its
    // lettering was unreadable — the one thing a wordmark is for.
    //
    // The SHAPE is pinned, not the number: bound the height, leave the width
    // free, cap it. Retuning the height is a design call and should not have to
    // come here; rendering a logo into a fixed square is the defect.
    const { withLogo } = logoBranches();
    expect(withLogo).not.toContain("size-9");
    // No trailing \b: after the `]` of an arbitrary value there is no word
    // boundary, so `h-[50px]` failed to match while `h-9` passed — the
    // assertion would have rejected the very form it was widened to allow.
    expect(withLogo).toMatch(/\bh-(?:\d+|\[[^\]]+\])/);
    expect(withLogo).toContain("w-auto");
    // Capped, or a very wide logo pushes the nav off the row.
    expect(withLogo).toMatch(/max-w-\[\d+px\]/);
  });

  it("does not print the shop's name beside a logo that already says it", () => {
    // The name used to render unconditionally, after the ternary. A wordmark
    // logo then produced "[logo reading Sweet Crumbs Bakery] Sweet Crumbs Bakery".
    //
    // `>` first: the name as ELEMENT TEXT is what a customer reads. Matching a
    // bare `{siteName}` would also hit `alt={siteName}` on the image, which must
    // stay — so the assertion would have been unfailable in the direction that
    // matters, and green whether the visible name was there or not.
    const VISIBLE_NAME = />\s*\{siteName\}/;
    const { withLogo, withoutLogo, afterTernary } = logoBranches();
    // Inside the no-logo branch, and ONLY there.
    expect(withoutLogo).toMatch(VISIBLE_NAME);
    expect(withLogo).not.toMatch(VISIBLE_NAME);
    // The one that catches the original bug: rendered after the ternary closes,
    // the name reached both branches and sat beside the wordmark.
    expect(afterTernary).not.toMatch(VISIBLE_NAME);
  });

  it("keeps the name reachable when the image is the only thing carrying it", () => {
    // Losing the visible name must not lose it for a screen reader, and a
    // logo URL that 404s still falls back to the letter badge and the name.
    const { withLogo, withoutLogo } = logoBranches();
    expect(withLogo).toContain("alt={siteName}");
    expect(withLogo).toContain("setLogoBroken(true)");
    expect(withoutLogo).toContain("{logoLetter}");
  });
});
