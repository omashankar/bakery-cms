import type { LandingProduct } from "@/constants/landing-data";
import { getOccasions } from "@/features/catalog/lib/catalog-repository";
import { defaultOccasions } from "@/features/catalog/lib/catalog-utils";

export type CollectionSort = "name" | "price-asc" | "price-desc" | "popular";

export interface CollectionFilters {
  search: string;
  sort: CollectionSort;
  occasions: string[];
  /**
   * What is ticked, per QUESTION the shop asked.
   *
   * Keyed by `optionFacetKey(group.name)` — never by `group.id`, which is minted
   * fresh per product, so "Shape" carries a different id on all 29 of this
   * shop's cakes and a box built on ids would be 29 boxes of one option each.
   *
   * A key is ABSENT when nothing under it is ticked; it is never present and
   * empty. `countActiveFilters` and the matcher both lean on that.
   */
  options: Record<string, string[]>;
  /**
   * The LEGACY per-product flavour list, and nothing else now.
   *
   * This used to hold ticks from a box headed "Flavour" that was fed by every
   * variant option in the catalogue: Regular, Eggless, Round, Square, Heart —
   * not one of them a flavour, and on a shop selling chargers it read 65W and
   * Type-C. Those live in `options` above, under the shop's own headings.
   *
   * What is left is the one thing the word was ever true of: the comma-separated
   * list on the product form, gated by the flavour module.
   */
  flavours: string[];
  weights: string[];
  priceMin: number;
  priceMax: number;
  inStockOnly: boolean;
}

/** One filter box: the shop's own question, and the answers worth offering. */
export interface CollectionFilterFacet {
  /** Folded name — matches `CollectionFilters.options` and a product's groups. */
  key: string;
  /** The spelling to print, chosen from what the products actually say. */
  name: string;
  options: string[];
}

/**
 * One spelling for a group name or an option label.
 *
 * Case and inner spacing folded, so "Egg preference", "Egg Preference" and
 * "Egg  preference" are one box rather than three, each holding a third of the
 * catalogue. Folding the KEY rather than the display text means a tick survives
 * a shop tidying its capitalisation.
 */
export function optionFacetKey(value: string): string {
  return value.trim().replace(/\s+/gu, " ").toLowerCase();
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

/**
 * The starting filters for a given catalogue: nothing filtered out.
 *
 * `options` is rebuilt rather than spread. The spread above it is shallow, so
 * every caller of this function — and the fifteen test files that spread the
 * constant — would otherwise share ONE record between them, and the first
 * `filters.options[key].push(...)` anywhere would reach all of them.
 */
export function defaultCollectionFilters(priceCeiling: number): CollectionFilters {
  return { ...DEFAULT_COLLECTION_FILTERS, options: {}, priceMax: priceCeiling };
}

export const DEFAULT_COLLECTION_FILTERS: CollectionFilters = {
  search: "",
  sort: "popular",
  occasions: [],
  // Frozen, so the shared-identity hazard above fails loudly at the line that
  // caused it rather than quietly in whichever test happens to run next.
  options: Object.freeze({}) as Record<string, string[]>,
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
 * The questions this shop's products ask, each with its own answers.
 *
 * This is the whole point of the change. There was ONE box, headed "Flavour",
 * and `getFilterFlavourOptions` poured every variant option in the catalogue
 * into it. On this shop it offered Regular, Eggless, Round, Square and Heart —
 * five ticks under a heading that was true of none of them — and a shop selling
 * chargers would have read "Flavour: 65W, Type-C, Black". The heading was
 * hard-coded in the panel and nothing narrowed the list to groups named Flavour,
 * because nothing knew which group a label had come from.
 *
 * Now a box is a GROUP. The name is the shop's own, so a nursery gets "Pot size"
 * and a hardware shop gets "Wattage" without this file learning either word.
 *
 * Built from the products the page is showing, like the sizes below and for the
 * same reason: a box can never offer a tick that matches nothing, and a category
 * page never heads a box with a question nothing on it answers.
 */
export function getFilterOptionFacets(products: LandingProduct[]): CollectionFilterFacet[] {
  /** key -> { spellings of the name, label counts, how many products carry it } */
  const facets = new Map<
    string,
    { names: Map<string, number>; labels: Map<string, { text: string; count: number }>; carriers: number }
  >();

  for (const product of products) {
    for (const group of product.optionGroups ?? []) {
      const key = optionFacetKey(group.name ?? "");
      if (!key) continue;

      let facet = facets.get(key);
      if (!facet) {
        facet = { names: new Map(), labels: new Map(), carriers: 0 };
        facets.set(key, facet);
      }
      const name = (group.name ?? "").trim();
      facet.names.set(name, (facet.names.get(name) ?? 0) + 1);
      facet.carriers += 1;

      for (const raw of group.labels ?? []) {
        const label = raw?.trim();
        if (!label) continue;
        const folded = optionFacetKey(label);
        const seen = facet.labels.get(folded);
        // First spelling wins the display text only until a commoner one
        // appears; `commonest` below settles it the same way names are settled.
        if (seen) seen.count += 1;
        else facet.labels.set(folded, { text: label, count: 1 });
      }
    }
  }

  const commonest = (counts: Map<string, number>) =>
    [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "";

  return [...facets.entries()]
    .map(([key, facet]) => ({
      key,
      name: commonest(facet.names),
      carriers: facet.carriers,
      options: [...facet.labels.values()]
        .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text))
        .map((label) => label.text),
    }))
    /**
     * A box that cannot narrow anything is a heading spent on nothing.
     *
     * One option is not enough on its own to drop it — "Gift wrap: Yes" carried
     * by 3 products out of 400 is a working filter. What makes it useless is one
     * option that EVERY product in scope carries, because then the tick keeps
     * the whole page. That is this shop's "Shape: Round" if it ever narrows to
     * one; it is not "Egg preference: Eggless" on the one product that has it.
     */
    .filter(
      (facet) =>
        facet.options.length > 1 ||
        (facet.options.length === 1 && facet.carriers < products.length),
    )
    // The questions most of the shop answers, first.
    .sort((a, b) => b.carriers - a.carriers || a.name.localeCompare(b.name))
    .map(({ key, name, options }) => ({ key, name, options }));
}

/** What is ticked in one box — never index `filters.options` raw. */
export function tickedOptions(filters: CollectionFilters, key: string): string[] {
  return filters.options?.[key] ?? [];
}

/**
 * Drop ticks for boxes this page does not offer.
 *
 * A customer ticks "Wattage: 65W" on Chargers and clicks through to Plants. The
 * tick is still in state, no box on the new page shows it, and — because a
 * product that does not carry the group falls back to its own words — the grid
 * empties with nothing on screen to explain why.
 *
 * Returns the SAME object when nothing is dropped. That is load-bearing, not
 * tidiness: the page runs `useEffect(() => setPage(1), [categorySlug, filters])`,
 * so a fresh object every render would send a customer on page 3 back to page 1
 * on every keystroke.
 */
export function pruneOptionSelections(
  filters: CollectionFilters,
  offered: CollectionFilterFacet[],
): CollectionFilters {
  const available = new Map(offered.map((facet) => [facet.key, new Set(facet.options.map(optionFacetKey))]));
  const kept: Record<string, string[]> = {};
  let changed = false;

  for (const [key, labels] of Object.entries(filters.options ?? {})) {
    const offeredLabels = available.get(key);
    const surviving = offeredLabels
      ? labels.filter((label) => offeredLabels.has(optionFacetKey(label)))
      : [];
    if (surviving.length !== labels.length) changed = true;
    if (surviving.length > 0) kept[key] = surviving;
  }

  return changed ? { ...filters, options: kept } : filters;
}

/**
 * The flavours this shop actually sells, read off the products it is selling.
 *
 * It was the shop-wide Catalog taxonomy — a list somebody had to maintain
 * beside the products, which could offer Butterscotch when nothing on the page
 * is butterscotch, and could miss the one flavour a shop had typed on twenty
 * products but never added to the list.
 *
 * Now it reads the same field `matchesFlavour` compares against, so the panel
 * can no longer offer a tick that matches nothing. Ordered by how many products
 * carry it, so a shop's usual flavours come first rather than whichever product
 * happened to be added first.
 *
 * `optionLabels` used to be read here too, and that was the bug: every variant
 * option in the catalogue arrived under the word "Flavour". Variant options are
 * `getFilterOptionFacets` above, under the shop's own headings. What is left
 * here is the legacy comma-separated list and only that — which is empty on
 * every product in this shop, so the box does not render at all.
 */
export function getFilterFlavourOptions(products: LandingProduct[]): string[] {
  const counts = new Map<string, number>();

  for (const product of products) {
    for (const raw of product.flavours ?? []) {
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

/**
 * Does this text say that word — as a word, not as a fragment?
 *
 * The filter used to ask `haystack.includes(word)`, which kept an "all-round
 * favourite" under Round, an "Irregular" under Regular and a "Blackout Curtain
 * Rod" under Black. Punctuation is flattened to spaces rather than stripped, so
 * "Type-C" is found in "USB Type-C cable" and "65W" in "65W charger".
 *
 * `\p{L}\p{N}` with /u rather than \w, or every non-Latin label — a shop typing
 * its options in Hindi or Tamil — would fold to nothing and match everything.
 */
function saysWord(text: string, word: string): boolean {
  const pad = (value: string) => ` ${value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;
  const needle = pad(word);
  return needle.trim().length > 0 && pad(text).includes(needle);
}

/**
 * Match the ticks a customer left in the shop's own boxes.
 *
 * AND across boxes, OR inside one: "Shape: Heart or Square, AND Egg preference:
 * Eggless" is what a sidebar full of checkboxes reads as.
 *
 * The rule that took the longest to settle is what happens to a product that
 * does not carry the box's group at all, and this shop is why. Its four cakes
 * named "Eggless Chocolate Fudge", "Eggless Vanilla Dream", "Eggless Fruit
 * Fantasy" and "Eggless Red Velvet" carry NO "Egg preference" group — a
 * migration removed it, correctly, because charging ₹80 to make an eggless cake
 * eggless is not a choice. Match strictly on the group and those four vanish
 * from the Eggless filter: the shop's actual eggless cakes, hidden from the
 * customer asking for eggless.
 *
 * So: if the product ANSWERS the question, its answer decides — exactly, never
 * against its prose, so ticking Round no longer keeps an "all-round favourite".
 * If it does not answer, fall back to the words the shop wrote. The four cakes
 * say Eggless in their names and are kept; ticking "Regular" drops them, which
 * is right, because they cannot be made regular.
 */
function matchesOptionFacets(
  cake: LandingProduct,
  selection: Record<string, string[]> | undefined,
): boolean {
  const asked = Object.entries(selection ?? {}).filter(([, labels]) => labels.length > 0);
  if (asked.length === 0) return true;

  const owned = new Map<string, Set<string>>();
  for (const group of cake.optionGroups ?? []) {
    const key = optionFacetKey(group.name ?? "");
    if (!key) continue;
    const set = owned.get(key) ?? new Set<string>();
    owned.set(key, set);
    for (const label of group.labels ?? []) set.add(optionFacetKey(label));
  }

  return asked.every(([key, labels]) => {
    const mine = owned.get(key);
    if (mine && mine.size > 0) return labels.some((label) => mine.has(optionFacetKey(label)));
    return labels.some((label) => saysWord(`${cake.name} ${cake.description}`, label));
  });
}

/**
 * The LEGACY flavour list, matched the same way its box is now built.
 *
 * This read `optionLabels` first, which is what made a box headed "Flavour"
 * answer for Shape and Egg preference. Variant options are `matchesOptionFacets`
 * above now; this compares the comma-separated list on the product form, and
 * falls back to the shop's own words for a product that never filled it in.
 */
function matchesFlavour(cake: LandingProduct, flavours: string[]): boolean {
  if (flavours.length === 0) return true;

  const owned = new Set((cake.flavours ?? []).map(optionFacetKey));
  if (owned.size > 0) return flavours.some((flavour) => owned.has(optionFacetKey(flavour)));
  return flavours.some((flavour) => saysWord(`${cake.name} ${cake.description}`, flavour));
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
      matchesOptionFacets(cake, filters.options) &&
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
  /**
   * One per BOX, keeping the convention every other axis here uses: three ticks
   * in one box is one filter, one tick in each of three boxes is three.
   *
   * `Object.values`, never `.length` — `options` is a record, `.length` on it is
   * `undefined`, and `if (undefined)` is a badge that silently stops counting.
   * That is how the mobile sheet would close over three ticked boxes reading
   * plain "Filters" while the grid behind it was filtered.
   */
  for (const labels of Object.values(filters.options ?? {})) {
    if (labels.length) count += 1;
  }
  if (filters.flavours.length) count += 1;
  if (filters.weights.length) count += 1;
  if (filters.inStockOnly) count += 1;
  if (filters.priceMin > 0 || filters.priceMax < priceCeiling) count += 1;
  return count;
}
