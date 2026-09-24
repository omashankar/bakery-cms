import { getCatalog } from "@/features/catalog/server/catalog.service";

/**
 * The shop's own product categories, for the storefront's category pills.
 *
 * The pills were the shipped demo taxonomy from landing-data, so a category the
 * shop added had no pill and could only be reached by typing its URL, a renamed
 * one still showed its old name, and a deleted one kept a pill leading nowhere.
 *
 * NO DEMO LIST, IN EITHER FAILURE.
 *
 * This substituted the shipped demo taxonomy — Birthday Cakes, Photo Cakes,
 * Eggless Cakes, Seasonal, nine rows of it — whenever the shop's own list came
 * back empty, on the argument that browsing by the wrong names beats not
 * browsing at all. That argument does not survive the question this CMS is
 * sold on: a brand-new florist, whose list IS empty, was handed nine cake
 * pages in the header of every storefront page, each of them a link to an
 * empty grid.
 *
 * It also made the component's own fallback dead code. `useFallbackCategories`
 * in mega-menu.tsx exists for exactly this case and is written for any trade —
 * and it could never run, because the server had already filled the list.
 * The test covering it was reading a branch no storefront reached.
 *
 * Empty on a throw too, which is the answer the occasions sibling below
 * already argues for in its own docblock: a database that cannot be read is
 * not a shop that sells cakes.
 *
 * DE-DUPLICATED BY SLUG, here rather than in each consumer.
 *
 * The list is admin-typed and nothing stops two rows sharing a slug — this shop
 * has two called "Seasonal". Every consumer renders one link per row keyed by
 * its href, so a duplicate is two identical links to the same page and a React
 * key collision. The collections page had already learned this and de-duped its
 * own pills; feeding the same raw list to the header's Shop menu reproduced the
 * bug there, which is the argument for fixing it at the source: the next
 * consumer should not have to find out too.
 */
export async function getStorefrontCategories(): Promise<
  { id: string; name: string; slug: string; image?: string }[]
> {
  try {
    const catalog = await getCatalog();
    const rows = (catalog.categories ?? []) as { id: string; name: string; slug: string; image?: string }[];
    return dedupeBySlug(rows);
  } catch {
    return [];
  }
}

/**
 * The shop's OWN occasions — Birthday, Anniversary, whatever it added.
 *
 * The mega menu's second column was three hardcoded bakery entries, and the
 * file holding them said so in as many words: "every entry here is a promise
 * this file cannot keep on its own". A florist got Birthday, Anniversary and
 * Wedding whether or not it had them; a shop that created "Housewarming" got
 * no way in.
 *
 * The list is real and already populated — occasions are a live membership
 * axis, tagged on products and matched at /store/collections/<slug> — so
 * this is the menu catching up with data the shop already has.
 *
 * No demo fallback and `[]` on a throw, for the same reason as collections:
 * an occasion nobody created is a menu row that opens an empty grid.
 */
export async function getStorefrontOccasions(): Promise<
  { id: string; name: string; slug: string }[]
> {
  try {
    const catalog = await getCatalog();
    const rows = (catalog.occasions ?? []) as { id: string; name: string; slug: string }[];
    /**
     * Deduped within this list only.
     *
     * It used to be deduped against the CATEGORIES as well, and that was right
     * while the two shared one address: /store/collections/<slug> resolved
     * against categories OR occasions, so a shop with a "Birthday Cakes"
     * category and a "Birthday" occasion — this one has that, and the same at
     * wedding and anniversary — had the identical page listed twice in the
     * menu under two different words. Categories won because they are the
     * column the menu is built around.
     *
     * An occasion has its own address now. The two rows are two destinations,
     * and hiding one of them here is what kept this shop's Birthday occasion —
     * nineteen products — from ever being shown as a set. Dropping the dedup is
     * the point of that route, not a side effect of it.
     */
    const bySlug = new Map<string, { id: string; name: string; slug: string }>();
    for (const { id, name, slug } of rows) {
      // First row wins within the list, as everywhere else: a second row with
      // the same slug is unreachable and must not be offered as though it were
      // not.
      if (slug && !bySlug.has(slug)) bySlug.set(slug, { id, name, slug });
    }
    return [...bySlug.values()];
  } catch {
    return [];
  }
}

/**
 * The shop's CURATED groups. Empty is a real and common answer.
 *
 * No demo fallback, unlike `getStorefrontCategories` above — and that
 * asymmetry is the point. A shop with no categories has a broken catalogue
 * and the shipped list at least renders something; a shop with no
 * collections has simply not made any, and inventing some would put groups
 * on the storefront the owner never created and cannot explain.
 *
 * A throw returns `[]` for the same reason: the collection route falls
 * through to the category path when nothing matches, so an unreachable
 * catalogue degrades to the behaviour this route had before collections
 * existed rather than to a 500.
 */
export async function getStorefrontCollections(): Promise<
  { id: string; name: string; slug: string; description?: string; image?: string; productIds: string[] }[]
> {
  try {
    const catalog = await getCatalog();
    const rows = (catalog.collections ?? []) as {
      id: string;
      name: string;
      slug: string;
      description?: string;
      image?: string;
      productIds?: string[];
    }[];
    const bySlug = new Map<string, (typeof rows)[number] & { productIds: string[] }>();
    for (const row of rows) {
      // Same first-row-wins rule as the categories above: a second row with
      // the same slug is simply unreachable, so it must not be returned as
      // though it were.
      if (row.slug && !bySlug.has(row.slug)) {
        bySlug.set(row.slug, { ...row, productIds: row.productIds ?? [] });
      }
    }
    return [...bySlug.values()];
  } catch {
    return [];
  }
}

/** First row wins, and a row with no slug is not a category anyone can reach. */
function dedupeBySlug(
  rows: { id: string; name: string; slug: string; image?: string }[],
): { id: string; name: string; slug: string; image?: string }[] {
  const bySlug = new Map<string, { id: string; name: string; slug: string; image?: string }>();
  for (const { id, name, slug, image } of rows) {
    if (slug && !bySlug.has(slug)) bySlug.set(slug, { id, name, slug, image });
  }
  return [...bySlug.values()];
}
