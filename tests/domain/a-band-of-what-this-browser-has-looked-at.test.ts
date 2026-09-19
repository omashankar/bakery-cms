import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { HOMEPAGE_SECTION_REGISTRY } from "@/constants/section-registry";

/**
 * THE ONLY BAND ON THE HOMEPAGE THAT IS DIFFERENT FOR EVERY VISITOR.
 *
 * Every other section is content the shop writes, the same for everybody. This
 * one is the products THIS BROWSER has opened — slugs in localStorage, put
 * there by the product page, which has been recording them all along. The cart
 * already draws a row from the same store; this is that, on the homepage, as a
 * band the shop can name, position and cap.
 *
 * THREE THINGS IT HAS TO GET RIGHT, and none of them shows in a diff:
 *
 *   localStorage does not exist on the server. Read during render, the browser
 *   builds a row the HTML does not have, React calls it a hydration mismatch
 *   and throws the client tree away. It starts empty on both sides and fills
 *   in an effect.
 *
 *   The slugs are resolved against the SHOP'S records, never against anything
 *   the browser holds. The version that used the browser's own cache once
 *   rendered a demo cake's price into a customer's cart, which checkout then
 *   refused — the docblock on `getRecentlyViewedProducts` is about that.
 *
 *   A first-time visitor has looked at nothing. A heading over an empty strip
 *   is worse than no band, so it draws nothing at all — measured on the live
 *   page: absent for a fresh browser, four cards after four product pages.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";

const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

const entry = HOMEPAGE_SECTION_REGISTRY.find((s) => s.type === "recently-viewed");

function band(): string {
  const src = codeOf(read(RENDERER));
  const at = src.indexOf("function RecentlyViewedSection(");
  expect(at, "the band is gone").toBeGreaterThan(-1);
  const next = src.indexOf("\nfunction ", at + 10);
  return src.slice(at, next < 0 ? src.length : next);
}

describe("a band of what this browser has looked at", () => {
  it("is a section a shop can add, name and cap", () => {
    expect(entry, "the band is not in the registry").toBeTruthy();

    const keys = entry!.fields.map((f) => f.key);
    expect(keys, "it cannot be named").toContain("title");
    expect(keys, "it cannot be capped").toContain("maxCount");
    expect(keys, "it has no way in").toContain("ctaHref");

    // It has NO list and no content of its own: the products are the
    // visitor's, and a box to type them into would be a lie about what it is.
    expect(entry!.fields.some((f) => f.type === "list"), "it has content of its own")
      .toBe(false);
  });

  it("and reaches the page through the dispatch, not just the union", () => {
    /*
      A TYPE IN THE UNION WITH NO CASE falls through to `default: return null`.
      The band appears in Add Section, can be filled in, reordered, published —
      and the homepage simply has nothing where the shop put it.
    */
    const src = codeOf(read(RENDERER));

    expect(src, "the band is never dispatched").toContain('case "recently-viewed":');
    expect(src, "the band is never drawn").toContain("<RecentlyViewedSection {...props} />");
  });

  it("and reads the browser in an effect, never during render", () => {
    /*
      THE HYDRATION RULE. `getRecentlyViewedProducts` reads localStorage, which
      the server does not have. Called in the body, the first client render
      disagrees with the HTML and React discards the tree.
    */
    const body = band();
    const at = body.indexOf("useEffect(");
    expect(at, "there is no effect at all").toBeGreaterThan(-1);

    const beforeEffect = body.slice(0, at);
    expect(
      beforeEffect.includes("getRecentlyViewedProducts("),
      "the browser is read during render",
    ).toBe(false);
    expect(body, "the row is not state, so it cannot arrive late").toContain(
      "useState<LandingProduct[]>([])",
    );
  });

  it("and notices when the visitor looks at something else", () => {
    // The product page fires this after recording. Without it a customer who
    // opens a product in another tab comes back to a stale row.
    const body = band();

    expect(body, "the band never listens").toContain(
      "window.addEventListener(RECENTLY_VIEWED_UPDATED_EVENT, read)",
    );
    expect(body, "the listener is never removed").toContain(
      "window.removeEventListener(RECENTLY_VIEWED_UPDATED_EVENT, read)",
    );
  });

  it("and resolves the slugs against the shop's own records", () => {
    /*
      NOT AGAINST ANYTHING THE BROWSER HOLDS. A customer's browser has no
      catalogue — the product cache is filled only inside the admin — so the
      version that used it rendered a DEMO cake's price into a real cart.
    */
    expect(band(), "the slugs are resolved against the browser").toContain(
      "getRecentlyViewedProducts(catalogue ?? [])",
    );

    const server = read("apps/website/lib/homepage-render-data.server.ts");
    expect(server, "the page does not carry the shop's cards").toContain(
      "getStorefrontProductCards()",
    );
    expect(server, "the cards are not handed to the renderer").toContain("catalog: storefrontCards");
  });

  it("and draws nothing at all for a visitor who has looked at nothing", () => {
    /*
      Which is most first visits. A heading over an empty strip is worse than
      no band — and the builder says so instead of vanishing, because a
      section that renders nothing cannot be selected and an admin cannot fix
      what they cannot click.
    */
    const body = band();
    const at = body.indexOf("if (cakes.length === 0)");
    expect(at, "an empty row still draws").toBeGreaterThan(-1);

    expect(body.slice(at, at + 200), "the live page still draws an empty band").toContain(
      "if (!props.interactive) return null;",
    );
  });

  it("and suggests no wording the shop did not choose", () => {
    /*
      The title ships filled because a band with no heading whose contents
      change per visitor is unreadable, and "Recently viewed" claims nothing
      and is true of any trade. Everything else is blank, like every other
      band on this page.
    */
    expect(entry!.defaultContent.title).toBe("Recently viewed");
    for (const key of ["overline", "align", "ctaLabel", "ctaHref"]) {
      expect(entry!.defaultContent[key], `${key} ships with words in it`).toBe("");
    }
    for (const field of entry!.fields) {
      expect(field.placeholder ?? "", `${field.key} suggests wording`).toBe("");
    }
  });

  it("and has an icon both builder lists actually know", () => {
    /*
      TWO HAND-WRITTEN MAPS, and a name missing from either falls back to a
      generic one — five entries already do, so the band would show a sparkle
      in one list and a heart in the other.
    */
    const icon = entry!.icon;
    expect(icon, "the band has no icon").toBeTruthy();

    for (const path of [
      "apps/admin/builders/shared/add-section-dialog.tsx",
      "apps/admin/builders/shared/section-list-panel.tsx",
    ]) {
      expect(read(path), `${path.split("/").pop()} does not know ${icon}`).toContain(
        `  ${icon},`,
      );
    }
  });
});
