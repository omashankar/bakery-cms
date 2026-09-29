import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * THE BUY BUTTON LIVES ON THE PRODUCT PAGE, AND NOWHERE ELSE.
 *
 * It used to be on the card, on by default, and off only on the homepage rows.
 * The shop asked for it gone from everywhere but the product page, and the
 * card is the better argument anyway: every choice that makes one of these a
 * thing somebody wants — size, flavour, a message, a photograph — is made on
 * the product page, and a card cannot ask.
 *
 * A grid add was priced AS a set of choices regardless. The server resolves
 * each variant group to its default option and the weight to tier 0 and
 * charges for both, so a one-tap add always committed the customer to
 * something; the card carried a precomputed description of it so the cart
 * could at least say what. Now nothing commits them, so nothing has to
 * describe it.
 *
 * Measured before the change: 24 solid full-width buttons on the shop-all
 * page, 19 on an occasion page, 9 in the product page's own rails.
 */
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

const CARD = "components/storefront/product-card.tsx";
const RENDERER = "features/cms-sections/homepage-section-renderer.tsx";
const PRODUCT_PAGE = "apps/website/pages/product-detail-page.tsx";

const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

describe("a card does not sell, it links", () => {
  it("has no buy button and no way to switch one on", () => {
    /*
      THE PROP IS GONE TOO, not defaulted to false. A flag every caller must
      pass the same value is not a choice, and leaving it is an invitation for
      one row to turn the button back on.
    */
    const card = codeOf(read(CARD));

    expect(card, "the card adds to the cart again").not.toContain("addToCart");
    expect(card, "the buy button is back").not.toContain("Add to Cart");
    expect(card, "the switch that used to hide it is back").not.toContain("showAddToCart");
  });

  it("and no row passes a prop that no longer exists", () => {
    /*
      The homepage rows used to turn it off one by one. If any of them still
      does, the prop came back — and TypeScript would catch that, but only
      while the prop is absent from the type. This says it in the one place a
      reader looks.
    */
    const renderer = codeOf(read(RENDERER));
    for (const call of renderer.match(/<ProductCard[^>]*>/g) ?? []) {
      expect(call, `a homepage row still passes it: ${call}`).not.toContain("showAddToCart");
    }
  });

  it("but a card still says when a product is gone", () => {
    /*
      The button was the only thing on the card carrying "Out of stock".
      Without something here a customer taps through to a product page to find
      it unavailable — sent there by us, with the card giving no hint.
    */
    const card = codeOf(read(CARD));
    const tail = card.slice(card.indexOf('<div className="mt-auto'));

    expect(tail, "the price block moved").not.toBe("");
    expect(tail).toContain("Out of stock</p>");
  });

  it("and the product page is where the selling happens", () => {
    /*
      THE OTHER HALF, and the one that makes this a move rather than a
      deletion. Scoped to the page's own buy box: its rails mount the same
      card, so a file-wide search would pass on the card's own markup if the
      button ever came back to it.
    */
    const page = codeOf(read(PRODUCT_PAGE));

    expect(page, "the product page stopped offering to add to the cart").toContain("addToCart");
  });
});
