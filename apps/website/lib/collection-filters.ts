import type { LandingProduct } from "@/constants/landing-data";
import { getOccasions } from "@/features/catalog/lib/catalog-repository";
import { defaultOccasions } from "@/features/catalog/lib/catalog-utils";

export type CollectionSort = "name" | "price-asc" | "price-desc" | "popular";

export interface CollectionFilters {
  search: string;
  sort: CollectionSort;
  occasions: string[];
  flavours: string[];
  weights: string[];
  priceMin: number;
  priceMax: number;
  inStockOnly: boolean;
}

/**
 * The top of the price slider, when the shop sells nothing dearer.
 *
 * It used to be the top FULL STOP — a hard 5,000 that was also the default, so
 * every product above it was filtered out of Collections before a customer
 * touched anything, and `countActiveFilters` reported no filter active while it
 * happened. There was no slider position that showed them: 5,000 was the
 * maximum, and the maximum excluded them.
 *
 * This shop's three wedding cakes are ₹12,499, ₹15,999 and ₹18,999. All three
 * were unreachable through Collections, and /store/collections/wedding-cakes —
 * a category whose every product is above the cap — rendered "No Cakes found".
 * The most expensive things the bakery sells were the ones it could not show.
 */
export const COLLECTION_PRICE_FLOOR = 5000;

/**
 * A ceiling that includes the dearest cake, always.
 *
 * Rounded UP, never down: the guarantee the filter depends on is that at the
 * slider's maximum `cake.price > filters.priceMax` is false for every cake in
 * the catalogue. A ceiling below the highest price silently hides it again.
 */
export function collectionPriceCeiling(cakes: { price: number }[]): number {
  const highest = cakes.reduce(
    (max, cake) => (Number.isFinite(cake.price) ? Math.max(max, cake.price) : max),
    0,
  );
  if (highest <= COLLECTION_PRICE_FLOOR) return COLLECTION_PRICE_FLOOR;

  const step = 500;
  return Math.ceil(highest / step) * step;
}

/** The starting filters for a given catalogue: nothing filtered out. */
export function defaultCollectionFilters(priceCeiling: number): CollectionFilters {
  return { ...DEFAULT_COLLECTION_FILTERS, priceMax: priceCeiling };
}

export const DEFAULT_COLLECTION_FILTERS: CollectionFilters = {
  search: "",
  sort: "popular",
  occasions: [],
  flavours: [],
  weights: [],
  priceMin: 0,
  priceMax: COLLECTION_PRICE_FLOOR,
  inStockOnly: false,
};

export function getFilterOccasionOptions(): string[] {
  return getOccasions().map((item) => item.name);
}

/**
 * The flavours this shop actually sells, read off the products it is selling.
 *
 * It was the shop-wide Catalog taxonomy — a list somebody had to maintain
 * beside the products, which could offer Butterscotch when nothing on the page
 * is butterscotch, and could miss the one flavour a shop had typed on twenty
 * products but never added to the list.
 *
 * Now it reads the same two fields `matchesFlavour` compares against, so the
 * panel can no longer offer a tick that matches nothing. Ordered by how many
 * products carry it, so a shop's usual flavours come first rather than
 * whichever product happened to be added first.
 */
export function getFilterFlavourOptions(products: LandingProduct[]): string[] {
  const counts = new Map<string, number>();

  for (const product of products) {
    // The same pair, in the same order, that `matchesFlavour` reads: the
    // variant group first, then the legacy list kept for products stored
    // before flavours became one.
    for (const raw of [...(product.optionLabels ?? []), ...(product.flavours ?? [])]) {
      const label = raw?.trim();
      if (!label) continue;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label]) => label);
}

/**
 * The sizes this shop actually sells, read off the products it is selling.
 *
 * Three answers, in order. It was the hard-coded `["0.5 kg", "1 kg", "1.5 kg"]`,
 * so a shop that renamed or added a tier had a panel offering sizes it does not
 * sell. Then it was the shop-wide Catalog taxonomy, which was better but still
 * a second list to keep in step — a size could sit in Catalog with no product
 * using it, and a product could be sold in a size Catalog had never heard of.
 *
 * Now it is the products. A size is offered as a filter exactly when something
 * in front of the customer is sold in it, which is the only definition that
 * cannot go stale — and it is the same set `matchesWeight` compares against
 * two functions below, so the panel can no longer offer a tick that matches
 * nothing.
 *
 * Ordered by how many products use it, so the sizes a shop mostly sells come
 * first rather than whichever product happened to be added first.
 */
export function getFilterWeightOptions(products: LandingProduct[]): string[] {
  const counts = new Map<string, number>();

  for (const product of products) {
    for (const tier of product.weights ?? []) {
      const label = tier.label?.trim();
      if (!label) continue;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label]) => label);
}

/**
 * Stable occasion defaults for SSR and the client's first paint — identical on
 * server and client, so the filter panel hydrates without a mismatch. The panel
 * swaps in the (possibly customized) catalog values from localStorage after
 * mount.
 *
 * There is no flavour twin any more, and there does not need to be: flavours
 * come from the products the page was handed, which the server and the client
 * both have before they paint.
 */
export const DEFAULT_FILTER_OCCASION_OPTIONS: string[] = defaultOccasions.map((item) => item.name);

/**
 * Match the occasions the cake is TAGGED with.
 *
 * This searched the name, category and description for the occasion word, so
 * the Occasions checkboxes on the product form reached nobody: a cake tagged
 * Wedding was missed unless its prose happened to say "wedding", and a
 * birthday cake whose description mentioned "perfect after a wedding" was
 * offered under Wedding.
 *
 * Untagged products fall back to the old text search rather than vanishing —
 * the shipped demo catalogue carries no occasion ids.
 */
function matchesOccasion(cake: LandingProduct, occasions: string[]): boolean {
  if (occasions.length === 0) return true;

  const tagged = cake.occasions ?? [];
  if (tagged.length > 0) {
    const owned = new Set(tagged.map((name) => name.toLowerCase()));
    return occasions.some((occasion) => owned.has(occasion.toLowerCase()));
  }

  const haystack = `${cake.name} ${cake.category} ${cake.description}`.toLowerCase();
  return occasions.some((occasion) => haystack.includes(occasion.toLowerCase()));
}

function matchesFlavour(cake: LandingProduct, flavours: string[]): boolean {
  if (flavours.length === 0) return true;
  // `optionLabels` first: flavours are a variant group now, and the legacy
  // array is kept only for products stored before that.
  const chosen = [...(cake.optionLabels ?? []), ...(cake.flavours ?? [])];
  const haystack = `${cake.name} ${cake.description} ${chosen.join(" ")}`.toLowerCase();
  return flavours.some((flavour) => haystack.includes(flavour.toLowerCase()));
}

/**
 * Match the weight tiers the cake is actually SOLD in.
 *
 * This filtered on price bands — "1.5 kg" meant "costs at least 1400" — which
 * has nothing to do with weight. An expensive small cake was offered under
 * 1.5 kg and a cheap large one was hidden from it, and the bands only knew the
 * three hard-coded labels, so any tier a shop added matched nothing at all.
 *
 * Products with no tiers keep matching, so a shop selling single-size cakes
 * does not disappear the moment a customer touches the filter.
 */
function matchesWeight(cake: LandingProduct, weights: string[]): boolean {
  if (weights.length === 0) return true;

  const tiers = cake.weights ?? [];
  if (tiers.length === 0) return true;

  const owned = new Set(tiers.map((tier) => tier.label.trim().toLowerCase()));
  return weights.some((weight) => owned.has(weight.trim().toLowerCase()));
}

export function applyCollectionFilters(
  cakes: LandingProduct[],
  filters: CollectionFilters
): LandingProduct[] {
  const query = filters.search.trim().toLowerCase();

  let result = cakes.filter((cake) => {
    if (query) {
      // Same haystack as the search page, and for the same reason: this filter
      // runs on the card projection, where `description` is deliberately blank.
      // A third of this predicate could never match, while the flavours and
      // occasions the customer actually types were sitting unused in the same
      // payload.
      const haystack = [
        cake.name,
        cake.category,
        cake.description,
        ...(cake.optionLabels ?? []),
        ...(cake.flavours ?? []),
        ...(cake.occasions ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    if (cake.price < filters.priceMin || cake.price > filters.priceMax) return false;
    /*
      An "Eggless only" tick stood here, reading `cake.isEggless` — and, as a
      second chance, whether the shop happened to have typed "eggless" into
      the category name. Both are gone: the flag, because a recipe is the
      shop's claim to make in its own words rather than a boolean this
      software derives, and the category match because a word typed for filing
      should never decide what a page claims (see the note in
      product-detail-page.tsx).

      Nothing on a product says machine-readably that it is eggless any more,
      so a cross-catalogue tick for it cannot be honest. Searching the name
      and description is what remains, and that is what the shop writes.
    */
    if (filters.inStockOnly && cake.inStock === false) return false;

    return (
      matchesOccasion(cake, filters.occasions) &&
      matchesFlavour(cake, filters.flavours) &&
      matchesWeight(cake, filters.weights)
    );
  });

  result = [...result].sort((a, b) => {
    if (filters.sort === "price-asc") return a.price - b.price;
    if (filters.sort === "price-desc") return b.price - a.price;
    if (filters.sort === "popular") return (b.rating ?? 0) - (a.rating ?? 0);
    return a.name.localeCompare(b.name);
  });

  return result;
}

export function countActiveFilters(
  filters: CollectionFilters,
  /** The top of this catalogue's slider — where "up to X" means "everything". */
  priceCeiling: number = COLLECTION_PRICE_FLOOR,
): number {
  let count = 0;
  if (filters.occasions.length) count += 1;
  if (filters.flavours.length) count += 1;
  if (filters.weights.length) count += 1;
  if (filters.inStockOnly) count += 1;
  if (filters.priceMin > 0 || filters.priceMax < priceCeiling) count += 1;
  return count;
}
