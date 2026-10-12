import { ProductCard } from "@/components/storefront/product-card";
import {
  firstListingPage,
  productsForListing,
} from "@/apps/website/lib/collection-listing";
import { CollectionsPage, type CollectionsPageProps } from "./collections-page";

/**
 * A listing page, with its cards drawn on the SERVER.
 *
 * `CollectionsPage` is a client component — the filters, sort and paging
 * are the customer's to change — and it used to draw every card itself, so
 * the card's code and its price formatting (the browser's first currency
 * format loads locale data, ~100ms on a phone) ran during hydration. Here
 * every card the page could show is drawn once, as markup, and handed over
 * by product id; the client only chooses which to show and in what order.
 *
 * The four that open the page load their photos first, as the client did
 * with `index < 4`: on a slow phone the LCP element here is a card photo,
 * and an ordinary lazy image is not even requested until layout.
 */
export function CollectionsListing(props: Omit<CollectionsPageProps, "cards">) {
  const inCategory = productsForListing(props);
  const first = new Set(firstListingPage(props).slice(0, 4).map((cake) => cake.id));

  const cards: Record<string, React.ReactNode> = {};
  for (const cake of inCategory) {
    cards[cake.id] = <ProductCard cake={cake} priority={first.has(cake.id)} />;
  }

  return <CollectionsPage {...props} cards={cards} />;
}
