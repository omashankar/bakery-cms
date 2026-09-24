import { cache } from "react";

import {
  mapAdminProductToStorefront,
  type TaxonomyNames,
} from "@/features/products/lib/product-mapper";
import { getCatalog } from "@/features/catalog/server/catalog.service";
import { readProducts } from "@/features/products/data/products-store.server";
import * as productRepo from "@/features/products/server/product.repository";
import { purgeProductTraces } from "@/features/products/server/product-cascade.server";
import type { LandingProduct } from "@/constants/landing-data";
import type { Product, ProductFormData } from "@/types/product";
import {
  defaultProductUnitPrice,
  displayCompareAtPrice,
  formatVariantSummary,
} from "@/features/products/lib/product-pricing";
import {
  getDefaultVariantSelections,
  variantGroupsEnabledBy,
} from "@/features/products/lib/variant-utils";
import { defaultModuleSettings } from "@/features/settings/lib/settings-utils";
import { getSettings } from "@/features/settings/server/settings.service";
import type { ModuleSettings } from "@/types/settings";
import {
  buildCategoryRail,
  categoryStartingPrices,
  buildHomepageProducts,
  matchHomepageSource,
  type HomepageProductSource,
} from "@/features/products/lib/homepage-rails";

/**
 * Async product data access — the API the rest of the app should use on the server.
 *
 * Every function returns a Promise, so the eventual database swap is confined to
 * products-store.server.ts. Callers already await; they will not change.
 */

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * The shop's own category names, from the database.
 *
 * Without this the mapper falls back to `getCategoryById`, which reads a
 * localStorage-backed store — on the server that is `defaultCatalogStore`, the
 * DEMO taxonomy. Every server-rendered product page resolved its category
 * against the shipped list, so a renamed category never reached a customer and
 * a shop-added one rendered as the generic "Cakes".
 */
async function categoryNames(): Promise<TaxonomyNames> {
  try {
    const catalog = await getCatalog();
    const byId = (rows: unknown) =>
      new Map((rows as Array<{ id: string; name: string }>).map((r) => [r.id, r.name]));
    return { categories: byId(catalog.categories), occasions: byId(catalog.occasions) };
  } catch {
    // A catalog read that fails must not take the product page down with it.
    return {};
  }
}

/**
 * The same catalogue, as the slug/name pairs `filterProductsByCategory` needs.
 *
 * `categoryNames` above answers “what is this category called”, keyed by id.
 * A homepage row keyed by SLUG needs the other direction, and cannot get it
 * by slugifying the name: this shop has “Eggless Cakes” at /eggless.
 *
 * `getCatalog` is request-cached, so asking twice costs one read.
 */
async function categorySlugs(): Promise<{ name: string; slug: string }[]> {
  try {
    const catalog = await getCatalog();
    return (catalog.categories as Array<{ name: string; slug: string }>).map(
      (category) => ({ name: category.name, slug: category.slug }),
    );
  } catch {
    // A catalog read that fails must not take the homepage down with it.
    return [];
  }
}

/**
 * The shop's occasion slugs, so a homepage row can point at one.
 *
 * A row is stored as a SLUG and nothing else, and the shop decides which of the
 * three lists that slug lives in. This one exists because "birthday" moved:
 * it was a category, the catalogue was rebuilt so that categories say what a
 * thing IS, and the homepage's Birthday row went silent while
 * /store/collections/birthday — which falls back to the occasion — still held
 * nineteen products.
 */
async function occasionSlugs(): Promise<{ slug: string }[]> {
  try {
    const catalog = await getCatalog();
    return ((catalog.occasions ?? []) as Array<{ slug: string }>).map((row) => ({
      slug: row.slug,
    }));
  } catch {
    // A catalog read that fails must not take the homepage down with it.
    return [];
  }
}

/**
 * The shop's curated groups, for a homepage row that points at one.
 *
 * Slug and membership only — a row needs to know which products are in the
 * group, and nothing else about it. Same request-cached read as the categories
 * above, so asking for both costs one.
 */
async function collectionMembership(): Promise<{ slug: string; productIds?: string[] }[]> {
  try {
    const catalog = await getCatalog();
    return ((catalog.collections ?? []) as Array<{ slug: string; productIds?: string[] }>).map(
      (group) => ({ slug: group.slug, productIds: group.productIds }),
    );
  } catch {
    // A catalog read that fails must not take the homepage down with it.
    return [];
  }
}

/**
 * The product collection, read AT MOST ONCE per request.
 *
 * Five readers here take the whole list — `getProducts`, `getProductById`,
 * `getProductBySlug`, `getStorefrontProducts` and `getHomepageRails` — and the
 * homepage calls two of them side by side in the same `Promise.all`, so it
 * loaded every product document TWICE (plus the `products-seeded` flag each
 * `listAll` checks) for one render.
 *
 * Reads only, and only within one request. Every mutation below addresses its
 * own document through `productRepo` and none of them read back through here,
 * so a save is never answered from a copy taken before it.
 */
const readProductsOnce = cache(async (): Promise<Product[]> => readProducts());

export async function getProducts(): Promise<Product[]> {
  return readProductsOnce();
}

export async function getProductById(id: string): Promise<Product | null> {
  const products = await readProductsOnce();
  return products.find((product) => product.id === id) ?? null;
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const products = await readProductsOnce();
  return products.find((product) => product.slug === slug) ?? null;
}

/** Published products in the shape the storefront renders. */
export async function getStorefrontProducts(): Promise<LandingProduct[]> {
  const [products, names] = await Promise.all([readProductsOnce(), categoryNames()]);
  return products
    .filter((product) => product.status === "published")
    .map((product) => mapAdminProductToStorefront(product, names));
}

/**
 * Card-shaped projection: what a card RENDERS, plus what the filter panel FILTERS ON.
 *
 * Rails are handed to a Client Component, so every field crosses the wire in the
 * RSC payload. Sending whole products would ship descriptions, variant groups
 * and full weight tables that no card displays — fine at 25 products, ruinous at
 * 5,000.
 *
 * But the collections page filters this projection on the client, and the fields
 * its filters read were not in it. So the occasion filter fell back to searching
 * the prose, the flavour filter did too, "Eggless only" fell back to matching
 * the category NAME, and the weight filter — which now matches real tiers —
 * matched everything, because no card carried any tiers to match against.
 *
 * The four fields below are what those filters need, kept as small as they can
 * be: occasion names are short strings, and the weight tiers are reduced to
 * their labels, since the filter compares labels and the card shows no prices
 * per tier.
 */
/**
 * The choices a grid add would commit to, resolved exactly as the server prices
 * them.
 *
 * Deliberately built from the SAME two helpers the pricing path uses —
 * `variantGroupsEnabledBy` then `getDefaultVariantSelections` — so the line a
 * card writes cannot describe one thing while `priceLine` bills another. The
 * weight is tier 0 for the same reason: that is the tier `priceLine` charges
 * when the line carries no label.
 */
function buildQuickAdd(
  product: LandingProduct,
  modules: ModuleSettings,
): LandingProduct["quickAdd"] {
  const groups = variantGroupsEnabledBy(product.variantGroups ?? [], modules);
  const variantSelections = getDefaultVariantSelections(groups);

  return {
    // Gated like the picker on the product page: a shop with Weight switched off
    // must not stamp a size on a line no customer was shown one for.
    weight: (modules.weight && product.weights?.[0]?.label) || undefined,
    weightLabel:
      (modules.weight && product.weights?.[0]?.label && product.weightLabel?.trim()) ||
      undefined,
    /**
     * The strike the CARD showed, so the cart repeats it rather than inventing
     * one. Computed from the record base price here, which is the last place
     * that still has it — `toCard` replaces `price` with the default-option
     * price a line below.
     */
    compareAtPrice: displayCompareAtPrice(
      product.price,
      product.compareAtPrice,
      defaultProductUnitPrice({ price: product.price, weights: product.weights, variantGroups: groups }),
    ),
    variantSelections: Object.keys(variantSelections).length > 0 ? variantSelections : undefined,
    variantSummary:
      groups.length > 0 ? formatVariantSummary(groups, variantSelections) : undefined,
  };
}

function toCard(product: LandingProduct, modules: ModuleSettings): LandingProduct {
  /**
   * The groups a customer would actually be shown, resolved ONCE.
   *
   * The same gate the two prices below use. It was called four separate times
   * in this function; a fifth caller that forgot the argument would have put a
   * filter box on the storefront for a module the shop had switched off.
   */
  const visibleGroups = variantGroupsEnabledBy(product.variantGroups ?? [], modules);
  const optionGroups = visibleGroups
    .map((group) => ({
      name: group.name?.trim() ?? "",
      // Deduped case-insensitively: two options spelled "Eggless" and "eggless"
      // are one checkbox, not two that split the same products between them.
      labels: [
        ...new Map(
          group.options
            .map((option) => option.label?.trim() ?? "")
            .filter(Boolean)
            .map((label) => [label.toLowerCase(), label] as const),
        ).values(),
      ],
    }))
    .filter((group) => group.name.length > 0 && group.labels.length > 0);

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    image: product.image,
    category: product.category,
    /**
     * The price the SHOP would charge for this cake untouched — not the base
     * price on the record.
     *
     * With nothing selected the server still applies each variant group's
     * default option, and those defaults are not always free: this shop's four
     * eggless cakes default to an "Eggless" option that adds ₹80. Cards showed
     * ₹1,099, the shop charged ₹1,179, and a customer who added one from a grid
     * met "Prices have changed" at the last step of checkout.
     *
     * Resolved here rather than on the client because `variantGroups` is not in
     * this payload and does not need to be — one number is smaller than the
     * groups it was computed from. Pricing itself is untouched: `priceCart`
     * reads full products straight from the repository, never a card.
     */
    price: defaultProductUnitPrice({
      price: product.price,
      weights: product.weights,
      // A module the shop has switched off is not priced, so a card must not
      // show its surcharge either — the server would not charge it.
      variantGroups: visibleGroups,
    }),
    /**
     * Moved by whatever moved the price above it.
     *
     * `price` here is the default-option price, not the record base — and this
     * shipped the record’s compare-at beside it, unshifted. So a Rs 1,000 cake
     * with a Rs 1,200 compare-at and a default eggless option at +Rs 80 was
     * advertised on the grid as Rs 1,080 struck against Rs 1,200, while its own
     * product page said Rs 1,080 against Rs 1,280 — two different savings for
     * the identical configuration, on two screens one click apart.
     *
     * `product-card.tsx` calls `displayCompareAtPrice` again over this value,
     * and that call is a no-op there by construction: the card has no variant
     * groups and its weight tiers are zeroed, so its shift is exactly 0.
     */
    compareAtPrice: displayCompareAtPrice(
      product.price,
      product.compareAtPrice,
      defaultProductUnitPrice({
        price: product.price,
        weights: product.weights,
        variantGroups: visibleGroups,
      }),
    ),
    badge: product.badge,
    rating: product.rating,
    reviewCount: product.reviewCount,
    inStock: product.inStock,
    /**
     * The outline a photo product prints in — one short string, or nothing.
     *
     * No card renders it. The CART does: a line carries the photograph the
     * customer fitted as a bare URL, and the only way to show it back in the
     * shape it will be printed is to look the shape up by slug against this
     * catalogue, which that page is already handed for the stock check. The
     * alternative is a new field on the cart line, which has to be threaded by
     * hand through the quote, the order, the invoice and the lists between
     * them — a great deal of surface for a value the server already knows.
     *
     * It costs nothing on the wire for the products that are not photo
     * products: `undefined` does not serialise.
     */
    photoFrameShape: product.photoFrameShape,
    description: "", // required by the type; never rendered on a card
    /**
     * THE ANSWER, not the groups it came from.
     *
     * A one-tap add from a grid is not a choiceless purchase — the server
     * resolves each group to its default option and the weight to tier 0, and
     * charges for both. What was missing was the cart ever SAYING so, which is
     * how a customer met "Egg preference: Regular" for the first time on the
     * invoice. So the shop resolves the same defaults here and hands them to
     * the card, which passes them straight into the line.
     *
     * `variantGroups` stays dropped — this is an id map and a few short strings,
     * not the groups behind them, and `toCard`'s payload is budgeted for 5,000
     * products. Module-gated, so a group the shop neither shows nor charges for
     * is not recorded either. `weights` here is already the product's own tiers,
     * so tier 0 is exactly what `priceLine` will bill.
     */
    quickAdd: buildQuickAdd(product, modules),
    // Filter inputs.
    /**
     * Every visible option, under the question the shop asked it for.
     *
     * The card carried `flavours` and nothing else, so a customer typing
     * “Eggless”, “Heart”, “Black” or “256GB” matched nothing — the search
     * haystack could only see one bakery-shaped field. The first answer to that
     * was a flat `optionLabels`, and flattening turned out to be the bug one
     * layer down: the collections sidebar poured the whole catalogue's options
     * into a single list headed “Flavour”.
     *
     * So the card carries the grouping too. Still not `variantGroups` — no ids,
     * no prices, no defaults, for the payload reason above — just each group's
     * name and the words under it.
     */
    optionGroups,
    /**
     * DERIVED, never gathered a second time.
     *
     * Search reads this and the sidebar reads the groups. Building them
     * separately is how "tick Heart in the sidebar, type Heart in search" comes
     * apart later — silently, because both halves still return results.
     */
    optionLabels: optionGroups.flatMap((group) => group.labels),
    // Carried across the RSC wire, or every client-side filter decides with
    // one category while the server decided with four — the exact class this
    // file already records, where a dropped field sent the occasion filter
    // searching the prose instead.
    categories: product.categories,
    // The ids too, because a coupon scope matches on those. This is the
    // narrow projection the cart and checkout actually receive, so a field
    // missing here is a field the browser can never see.
    categoryIds: product.categoryIds,
    // The speeds, for the listing page's delivery filter. Without this the
    // browser cannot tell an express-eligible product from any other.
    deliveryTierIds: product.deliveryTierIds,
    occasions: product.occasions,
    flavours: product.flavours,
    weights: product.weights?.map((tier) => ({ label: tier.label, price: 0 })),
  };
}

/**
 * The modules this shop sells, for pricing a card.
 *
 * Defaults are every module ON, so a settings document written before these
 * switches existed — or a database that cannot be reached — prices exactly as
 * it did before rather than silently dropping surcharges.
 */
async function readModuleSettings(): Promise<ModuleSettings> {
  try {
    const settings = (await getSettings()) as unknown as {
      modules?: Partial<ModuleSettings>;
    };
    return { ...defaultModuleSettings, ...(settings.modules ?? {}) };
  } catch {
    return defaultModuleSettings;
  }
}

export async function getStorefrontProductCards(): Promise<LandingProduct[]> {
  const [products, modules] = await Promise.all([getStorefrontProducts(), readModuleSettings()]);
  return products.map((product) => toCard(product, modules));
}

export async function getStorefrontProductBySlug(
  slug: string
): Promise<LandingProduct | null> {
  const product = await getProductBySlug(slug);
  if (!product || product.status !== "published") return null;
  return mapAdminProductToStorefront(product, await categoryNames());
}

/**
 * Mutations address ONE document.
 *
 * They used to go through `mutateProducts`: read the whole collection, change
 * one entry, and write every document back. An in-process queue serialised those
 * against each other, but two writers are not in it — order placement, which
 * does `$inc` on `stockQuantity` inside a transaction, and inventory
 * adjustments, which use `patchFields`. So a cake sold during an admin's save
 * had its stock restored by that save: three cakes gone, stock unchanged, and
 * the shop overselling with nothing to show for it. Bulk Publish over ten rows
 * did it ten times.
 */

function nextId(): string {
  // `Date.now()` plus a per-process counter collides across instances: two
  // servers minting an id in the same millisecond both start their counter at 1.
  const unique =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `product-${unique}`;
}

export async function createProduct(data: ProductFormData): Promise<Product> {
  const timestamp = nowIso();
  return productRepo.insertOne({
    ...data,
    id: nextId(),
    // Owned by the reviews aggregate, exactly as `updateProduct` below already
    // insists. This wrote the form's values verbatim, and the new-product form
    // defaulted to 4.5 — so every cake an admin added went on sale advertising
    // "4.5 ★" on its card and its product page, with no reviews behind it and
    // nothing the admin did to claim it. A shop's first honest review then
    // DROPPED the visible rating, because the aggregate replaced the invented
    // number with the real one.
    rating: 0,
    reviewCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  } as Product);
}

export async function updateProduct(
  id: string,
  data: ProductFormData
): Promise<Product | null> {
  const existing = await getProductById(id);
  if (!existing) return null;

  return productRepo.replaceOne(id, {
    ...existing,
    ...data,
    id,
    // `rating` and `reviewCount` are owned by the reviews aggregate, which
    // writes them directly. Letting an edit form carry its stale copy back would
    // undo a moderation decision made since this form was opened.
    rating: existing.rating,
    reviewCount: existing.reviewCount,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
  });
}

/**
 * Delete a product and everything that only existed because of it.
 *
 * Its reviews and stock-history rows used to stay behind, keyed by a slug and an
 * id nothing resolves. They still counted toward the review aggregate and the
 * History view, and — because the slug is free again — a NEW cake created with
 * the same slug inherited the deleted product's reviews and star rating.
 *
 * Best-effort on the cascade: a product the admin asked to remove must not
 * survive because a follow-up cleanup failed.
 */
export async function deleteProduct(id: string): Promise<boolean> {
  const existing = await getProductById(id);
  const removed = await productRepo.deleteOne(id);
  if (!removed || !existing) return removed;

  try {
    await purgeProductTraces(existing.slug, existing.id);
  } catch (error) {
    console.error(`[products] could not clean up after deleting ${existing.slug}`, error);
  }
  return true;
}

/** Publish or archive many products in one statement. */
export async function setProductStatus(
  ids: string[],
  status: Product["status"]
): Promise<number> {
  if (ids.length === 0) return 0;
  return productRepo.setStatusMany(ids, status);
}

/**
 * Homepage product rails, built on the server.
 *
 * The section renderer used to call the browser catalogue directly during
 * render, so the server pass produced seed data and the client swapped it after
 * hydration. Building the rails here keeps both passes identical.
 */
export async function getHomepageRails(maxCount = 8): Promise<{
  rails: Record<HomepageProductSource, LandingProduct[]>;
  /**
   * One rail per category the shop has, keyed by slug.
   *
   * This is what makes a homepage row nameable after something the shop
   * invented. Built here rather than on demand because the section renderer
   * runs in both passes and must not read a catalogue itself — that is the
   * bug this whole function exists to have fixed.
   */
  categoryRails: Record<string, LandingProduct[]>;
  /**
   * The cheapest live product in each category, over ALL of it.
   *
   * Beside the rails rather than derived from one, because a rail is capped
   * and a starting price may not be inside the cap.
   */
  categoryStartingPrices: Record<string, number>;
  /**
   * The FLAGGED rows, cut by category — "the bestsellers that are cakes".
   *
   * A tabbed row whose heading says Bestsellers and whose tabs say Cakes and
   * Flowers is making both statements at once, and neither rail already here
   * can answer it: `rails['best-sellers']` knows nothing about categories,
   * and `categoryRails[slug]` knows nothing about the flag.
   *
   * It cannot be done in the browser either. A card carries `badge`, not the
   * flags, and `badge` is derived with a PRECEDENCE — featured beats
   * bestseller beats trending — so a product that is both featured and a
   * bestseller reads "Featured", and filtering on the badge would drop it
   * from the bestsellers tab it belongs in.
   *
   * Only the three flag-driven sources, and only the pairs that hold
   * something: an empty combination is left out rather than serialised, so a
   * shop that flags nothing pays nothing for this.
   */
  flaggedCategoryRails: Partial<
    Record<HomepageProductSource, Record<string, LandingProduct[]>>
  >;
}> {
  const [products, names, categories, collections, occasions, modules] = await Promise.all([
    readProductsOnce(),
    categoryNames(),
    categorySlugs(),
    collectionMembership(),
    occasionSlugs(),
    readModuleSettings(),
  ]);
  const all = products
    .filter((product) => product.status === "published")
    .map((product) => mapAdminProductToStorefront(product, names));

  const sources: HomepageProductSource[] = [
    "featured",
    "trending",
    "best-sellers",
    "photo-cakes",
    "eggless",
    "seasonal",
  ];

  const rails = Object.fromEntries(
    sources.map((source) => [
      source,
      buildHomepageProducts(source, maxCount, products, all, names, categories, collections).map((product) =>
        toCard(product, modules),
      ),
    ])
  ) as Record<HomepageProductSource, LandingProduct[]>;

  /*
    EVERY SLUG A ROW COULD NAME, from all three lists.

    This was categories only, and a row is stored as a slug with no record of
    which list the shop put it in — so the day the catalogue was rebuilt and
    "birthday" became an occasion rather than a category, the homepage's
    Birthday row had no entry here and rendered nothing, while the page its
    "View all" opens still held nineteen products. The row and the page it
    advertises have to agree.

    Duplicates collapse: a slug in two lists gets one entry, resolved by
    `buildCategoryRail` in the same order the route uses.

    Empty rails are kept, including for slugs with nothing in them — that is
    what tells the builder the row it is previewing has no products, rather
    than leaving the section looking like it failed to load.
  */
  const railSlugs = [
    ...new Set([
      ...(categories ?? []).map((row) => row.slug),
      ...(occasions ?? []).map((row) => row.slug),
      ...(collections ?? []).map((row) => row.slug),
    ]),
  ].filter(Boolean);

  const categoryRails = Object.fromEntries(
    railSlugs.map((slug) => [
      slug,
      buildCategoryRail(slug, maxCount, all, all, categories, collections).map((product) =>
        toCard(product, modules),
      ),
    ]),
  ) as Record<string, LandingProduct[]>;

  /*
    THE PRICE A CARD SHOWS, not the price on the record.

    `all` carries `product.price` — the base figure in the database. What a
    customer reads on a grid is `toCard`'s price: the base with each variant
    group's DEFAULT option already applied, because that is what the server
    would charge for the thing untouched. The two differ by real money here:
    this shop's Birthday Cake is 999 on the record and 899 on the page.

    Caught by measuring rather than reading. The card said "Starting from
    Rs 749" while the page it links to started at Rs 899 — a price no
    customer could pay, on the one band whose whole job is to name that
    number. Mapping through `toCard` first is what makes the card's claim and
    the page it links to the same statement.
  */
  const cards = all.map((product) => toCard(product, modules));

  /*
    Built from the UNCAPPED flag list and capped after the category cut, not
    before. `buildHomepageProducts(source, maxCount, …)` slices first, so
    filtering its result would give "the bestsellers in this category, among
    the first twelve bestsellers" — which is the same shape of silent wrong
    answer as taking a starting price off a capped rail.
  */
  /*
    AND OVER ALL THREE LISTS, like the plain rails above.

    This cut the flag list by CATEGORY alone, which is the same fault the plain
    rails had: a tab is stored as a slug with no record of which list the shop
    put it in. Measured after this shop's catalogue was rebuilt — its
    Bestsellers band has tabs for Birthday, Pastries and Anniversary, and two of
    the three drew NOTHING, because birthday and anniversary had become
    occasions and this map had no entry for either. A band headed Bestsellers
    showing an empty tab is worse than no band.

    `buildCategoryRail` rather than `filterProductsByCategory`, so the cut
    resolves a slug the way the page behind the tab does: collection, then
    category, then occasion.
  */
  const FLAG_SOURCES: HomepageProductSource[] = ["featured", "trending", "best-sellers"];
  const flaggedCategoryRails: Partial<
    Record<HomepageProductSource, Record<string, LandingProduct[]>>
  > = {};

  for (const source of FLAG_SOURCES) {
    const flagged = matchHomepageSource(source, products, all, names, categories).map(
      (product) => toCard(product, modules),
    );

    const bySlug: Record<string, LandingProduct[]> = {};
    for (const slug of railSlugs) {
      const cut = buildCategoryRail(slug, maxCount, flagged, flagged, categories, collections);
      if (cut.length) bySlug[slug] = cut;
    }
    if (Object.keys(bySlug).length) flaggedCategoryRails[source] = bySlug;
  }

  return {
    rails,
    categoryRails,
    categoryStartingPrices: categoryStartingPrices(cards, categories),
    flaggedCategoryRails,
  };
}
