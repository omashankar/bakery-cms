import {
  bestSellers,
  egglessCakes,
  featuredProducts,
  photoCakes,
  seasonalCakes,
  trendingProducts,
  weddingCakes,
  type LandingProduct,
} from "@/constants/landing-data";
import { loadProducts } from "@/features/products/lib/products-repository";
import { slugify } from "@/utils/slug";
import { getPublishedStorefrontProducts } from "@/features/products/lib/product-mapper";

function getLandingCatalog(): LandingProduct[] {
  const combined = [
    ...featuredProducts,
    ...trendingProducts,
    ...bestSellers,
    ...weddingCakes,
    ...photoCakes,
    ...egglessCakes,
    ...seasonalCakes,
  ];
  const seen = new Set<string>();
  return combined.filter((cake) => {
    if (seen.has(cake.slug)) return false;
    seen.add(cake.slug);
    return true;
  });
}

function mergeStorefrontProducts(): LandingProduct[] {
  const landing = getLandingCatalog();
  const adminPublished = getPublishedStorefrontProducts(loadProducts());
  const adminBySlug = new Map(adminPublished.map((cake) => [cake.slug, cake]));

  const merged = landing.map((cake) => adminBySlug.get(cake.slug) ?? cake);

  for (const cake of adminPublished) {
    if (!landing.some((item) => item.slug === cake.slug)) {
      merged.push(cake);
    }
  }

  return merged;
}

/** All unique cakes — admin published overrides landing mock data */
export function getAllProducts(): LandingProduct[] {
  return mergeStorefrontProducts();
}

export function getProductBySlug(slug: string): LandingProduct | undefined {
  return getAllProducts().find((cake) => cake.slug === slug);
}

/**
 * Everything a search term is allowed to match on one cake.
 *
 * Search used to be name, category and DESCRIPTION — and the storefront's
 * search page runs on the card projection, where `toCard` deliberately sets
 * `description: ""` to keep the payload small. So a third of the predicate
 * matched nothing on the one surface that uses it, and a customer searching
 * for a word that appears only in a cake's description was told there were no
 * results.
 *
 * The flavours and occasions were already in that payload — carried for the
 * filter panel — and are what customers actually type ("chocolate",
 * "wedding"). The description stays in the haystack for callers that pass full
 * products, where it is real.
 */
/**
 * Everything a customer might type to find this product.
 *
 * `optionLabels` was missing, and the collections FILTER has read it all
 * along (`collection-filters.ts`) — so the two disagreed: ticking “Heart” in
 * the sidebar found the cake, typing “Heart” into search found nothing. Both
 * run over the same card projection, where `description` is empty, so option
 * labels are most of what a card has to match on.
 */
function searchHaystack(cake: LandingProduct): string {
  return [
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
}

export function searchProducts(query: string, catalog?: LandingProduct[]): LandingProduct[] {
  const source = catalog ?? getAllProducts();
  const normalized = query.trim().toLowerCase();
  if (!normalized) return source;

  return source.filter((cake) => searchHaystack(cake).includes(normalized));
}

/**
 * THE PRODUCTS AN OWNER PICKED, IN THE ORDER THEY PICKED THEM.
 *
 * Nothing like `filterProductsByCategory` below: that one MATCHES — it asks
 * every product whether it belongs, by name, and returns them in catalogue
 * order. A collection is the other thing entirely. It is a list somebody
 * wrote, and the order is the content: a shop puts its best seller first,
 * and no property of the products themselves can recover that afterwards.
 *
 * So this walks the IDS and looks each one up, rather than walking the
 * catalogue and testing each product. Two consequences, both deliberate:
 *
  - A product whose NAME matches the collection is not swept in. "Diwali
 *   Gifts" the collection and "Diwali Gifts" the category are different
 *   things, and a collection that quietly grew by name would stop being a
 *   curation the moment somebody added a category with the same words.
  - A deleted product leaves a SHORTER list, not a hole. The cost of storing
 *   ids on the collection is that they outlive what they point at; the
 *   filter is what keeps that from reaching `ProductCard` as `undefined`,
 *   which is the same tolerance `product-mapper` already applies to a
 *   deleted category id.
 */
export function productsInCollection(
  catalog: readonly LandingProduct[],
  productIds: readonly string[],
): LandingProduct[] {
  const byId = new Map(catalog.map((product) => [product.id, product]));
  return productIds
    .map((id) => byId.get(id))
    .filter((product): product is LandingProduct => Boolean(product));
}

export function filterProductsByCategory(
  cakes: LandingProduct[],
  categorySlug?: string,
  /** The shop's own categories, so a slug can be resolved to its name. */
  categories?: { name: string; slug: string }[],
): LandingProduct[] {
  if (!categorySlug) return cakes;
  const slug = slugify(categorySlug);

  /**
   * The shop's own taxonomy, resolved through the shop's own list.
   *
   * `cake.category` is the category's NAME — `product-mapper` resolves the id
   * to it — while the route carries its SLUG, and the two are edited
   * independently. This shop has "Birthday Cakes" at `/birthday`, "Eggless
   * Cakes" at `/eggless` and "Custom Cakes" at `/custom`, so neither comparing
   * them directly (`"birthday cakes".includes("birthday")` — false) nor
   * slugifying the name (`"birthday-cakes" !== "birthday"`) can work. Only the
   * category list knows which name goes with which slug.
   *
   * Passing it is optional so the homepage rails and the demo catalogue keep
   * working; without it this falls back to matching the slugified name, which
   * is right whenever a shop has not renamed a category away from its slug.
   */
  const named = categories?.find((category) => slugify(category.slug) === slug);
  /**
   * EVERY category the product is filed under, not just the one on its badge.
   *
   * `categories` is the full membership by name and `category` is the primary,
   * which is always its first element — but the primary is kept in this list
   * anyway, because a demo literal in `landing-data.ts` sets `category` alone
   * and would otherwise match nothing at all.
   *
   * Both branches keep the fold they had. `.some()` over one name behaves
   * exactly as the equality did, so a shop with no product in more than one
   * category sees no change.
   */
  const membership = (cake: LandingProduct) =>
    [cake.category, ...(cake.categories ?? [])].filter(Boolean);
  const byCategory = (cake: LandingProduct) =>
    named
      ? membership(cake).some(
          (name) => name.trim().toLowerCase() === named.name.trim().toLowerCase(),
        )
      : membership(cake).some((name) => slugify(name) === slug);

  /**
   * Occasion categories match the cake's OCCASION TAGS.
   *
   * These used to be guessed from flavour whitelists and name regexes — a
   * "birthday" page showed every chocolate, classic, premium, fruit and
   * international cake in the shop, whether or not the baker had tagged it for
   * birthdays, and "pastries" was a regex over the cake's name. `product-mapper`
   * already carries the real tags, and its own comment records why guessing was
   * wrong for exactly this: "a cake tagged Wedding was missed unless it happened
   * to say so in prose, and anything mentioning it in passing was included."
   */
  const byOccasion = (cake: LandingProduct) =>
    (cake.occasions ?? []).some((occasion) => slugify(occasion) === slug);

  /**
   * Two categories are properties of the cake rather than a taxonomy entry, and
   * the shop tags them on the product itself. Kept because they are real
   * fields, unlike the keyword guessing above.
   */
  const byAttribute = (cake: LandingProduct) => {
    if (slug === "photo-cakes" || slug === "photo") return cake.allowsPhotoUpload === true;
    return false;
  };

  return cakes.filter(
    (cake) => byCategory(cake) || byOccasion(cake) || byAttribute(cake),
  );
}

/**
 * The sizes THIS product is sold in. Empty when it is sold in one.
 *
 * It used to fall back to the shop's catalog weight presets, which was wrong in
 * two ways at once. A phone charger was offered "0.5 kg / 1 kg / 1.5 kg", and
 * picking 1 kg added the preset's +200 modifier to a real customer's real bill.
 * And the fallback read a different source on each side — the browser's
 * localStorage catalog (the shop's real tiers) versus the shipped seed on the
 * server — so the moment an owner edited Catalog > Weights, the label the
 * customer sent was absent from the server's list and `priceLine` threw
 * `UnknownWeightError`, turning every such product into a 409 at checkout.
 *
 * Reading only the product removes both: it is pure, identical on server and
 * client, and says nothing about a product that never claimed a size.
 */
export function getProductWeightOptions(cake?: LandingProduct) {
  if (!cake?.weights?.length) return [];

  return cake.weights.map((weight) => ({
    label: weight.label,
    modifier: Math.max(0, weight.price - cake.price),
    serves: weight.serves,
  }));
}

/*
  Two exports stood here and NOTHING imported either: a
  `getDefaultProductWeightOptions` whose comment claimed the product page used
  it for its first paint, and a `productWeightOptions` marked deprecated. Both
  named the shipped bakery tiers, which is why they went with them.
*/
