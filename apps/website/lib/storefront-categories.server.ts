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
/**
 * The rows a shop is OFFERING, in the order it put them.
 *
 * Three things, together, because all three readers below need all three and
 * doing them separately is how they drifted: each list had its own copy of the
 * dedupe and only one of them was a named function.
 *
 *  - SWITCHED OFF rows are dropped. `isActive` is optional, and absent means
 *    ON — a shop that has never seen the switch has every row showing, which
 *    is what it had before the switch existed. Only an explicit `false` hides
 *    anything.
 *  - ORDERED by `sortOrder`, lowest first. A row with none sorts after every
 *    numbered one and otherwise keeps its stored position, so a shop that
 *    orders three rows out of eleven gets those three at the top and the rest
 *    exactly where they were.
 *  - DEDUPED by slug, first row wins. A second row at one slug is unreachable
 *    — the resolver takes the first — so returning it offers a link that does
 *    not go where its label says.
 *
 * Sorted BEFORE the dedupe, so that when two rows share a slug the one the
 * shop ordered first is the one kept, rather than whichever was created first.
 */
function offeredRows<T extends { slug?: string; isActive?: boolean; sortOrder?: number }>(
  rows: readonly T[],
): T[] {
  const live = rows.filter((row) => row.isActive !== false);

  const ordered = [...live].sort((a, b) => {
    const left = typeof a.sortOrder === "number" ? a.sortOrder : Number.POSITIVE_INFINITY;
    const right = typeof b.sortOrder === "number" ? b.sortOrder : Number.POSITIVE_INFINITY;
    if (left !== right) return left - right;
    /* Equal, or both unset: the stored order stands. */
    return live.indexOf(a) - live.indexOf(b);
  });

  const bySlug = new Map<string, T>();
  for (const row of ordered) {
    if (row.slug && !bySlug.has(row.slug)) bySlug.set(row.slug, row);
  }
  return [...bySlug.values()];
}

export async function getStorefrontCategories(): Promise<
  { id: string; name: string; slug: string; image?: string }[]
> {
  try {
    const catalog = await getCatalog();
    const rows = (catalog.categories ?? []) as {
      id: string;
      name: string;
      slug: string;
      image?: string;
      isActive?: boolean;
      sortOrder?: number;
      headline?: string;
    }[];
    /*
      `headline` TRAVELS, and this projection is why it has to be added by
      hand. Collections are spread whole further down, so a headline written
      on a collection would have worked the day it shipped while the same
      field on a category died here silently — the worst shape a bug can have,
      because the feature looks half-built rather than broken.
    */
    return offeredRows(rows).map(({ id, name, slug, image, headline }) => ({
      id,
      name,
      slug,
      image,
      headline,
    }));
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
    const rows = (catalog.occasions ?? []) as {
      id: string;
      name: string;
      slug: string;
      isActive?: boolean;
      sortOrder?: number;
      headline?: string;
    }[];
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
    return offeredRows(rows).map(({ id, name, slug, headline }) => ({
      id,
      name,
      slug,
      headline,
    }));
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
      isActive?: boolean;
      sortOrder?: number;
    }[];
    return offeredRows(rows).map((row) => ({ ...row, productIds: row.productIds ?? [] }));
  } catch {
    return [];
  }
}


