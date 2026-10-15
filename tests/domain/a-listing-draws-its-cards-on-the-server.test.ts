import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";

import {
  bestSellers,
  featuredProducts,
  photoCakes,
  trendingProducts,
  type LandingProduct,
} from "@/constants/landing-data";
import { CollectionsListing } from "@/apps/website/pages/collections-listing";
import { firstListingPage, productsForListing } from "@/apps/website/lib/collection-listing";

/**
 * A LISTING PAGE'S CARDS ARE DRAWN ON THE SERVER, and the four that open it
 * load their photos first.
 *
 * The listing used to draw every card in the browser, with `priority` on the
 * first four of whatever it was showing. The cards are server markup now,
 * handed to the client component by product id — so the server has to know
 * which four open the page, and get it from the same pipeline the client
 * runs. Get it wrong and the LCP photo on a phone goes back to being lazy.
 */

type CardElement = ReactElement<{ cake: LandingProduct; priority?: boolean }>;

function render(props: Parameters<typeof CollectionsListing>[0]) {
  const element = CollectionsListing(props) as ReactElement<{
    cards: Record<string, CardElement>;
  }>;
  return element.props.cards;
}

// Unique by id: the demo lists share some products.
const catalog = [...featuredProducts, ...trendingProducts, ...bestSellers, ...photoCakes].filter(
  (cake, index, all) => all.findIndex((other) => other.id === cake.id) === index,
);

describe("a listing page's cards", () => {
  it("draws a card for every product the page is about, and no other", () => {
    const cards = render({ catalog });
    const expected = productsForListing({ catalog }).map((cake) => cake.id);

    expect(expected.length, "the fixture lists nothing").toBeGreaterThan(4);
    expect(Object.keys(cards).sort()).toEqual([...expected].sort());
    for (const id of expected) {
      expect(cards[id].props.cake.id).toBe(id);
    }
  });

  it("gives priority to exactly the four the customer sees first", () => {
    const cards = render({ catalog });
    const opening = firstListingPage({ catalog })
      .slice(0, 4)
      .map((cake) => cake.id);

    const prioritised = Object.entries(cards)
      .filter(([, card]) => card.props.priority)
      .map(([id]) => id);

    expect(prioritised.sort()).toEqual([...opening].sort());
  });

  it("follows the search the page opened with", () => {
    const target = catalog[catalog.length - 1];
    const cards = render({ catalog, initialSearch: target.name });
    const opening = firstListingPage({ catalog, initialSearch: target.name })
      .slice(0, 4)
      .map((cake) => cake.id);

    expect(opening, "the search found nothing").toContain(target.id);
    expect(cards[target.id].props.priority).toBe(true);
  });
});
