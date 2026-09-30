import { getCatalog } from "@/features/catalog/server/catalog.service";
import { offeredRows } from "@/features/catalog/lib/catalog-utils";

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
/*
  THE RULE MOVED, AND THAT IS THE POINT.

  It lived here, server-only, so the ADMIN could not ask the same question —
  and a screen that offers a switched-off row, or one whose slug somebody
  else holds, hands the shop a link that looks saved and never appears. It is
  one exported rule in the catalogue's own pure module now, read by this
  reader and by the screen where a shop picks a link.

  The three readers below call it exactly as they did.
*/

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



/**
 * The shop's DEPARTMENTS — the kind of thing, above the category.
 *
 * Same shape as the three readers above, and free for the same reason:
 * `getCatalog` is `cache()`d, so a fourth caller in one request is a fourth
 * read of one document already in hand.
 *
 * `categoryIds` travels because the caller has to know what is filed under
 * each one — that is the whole content of a department. It is a short list of
 * ids, not the rows behind them.
 */
export async function getStorefrontDepartments(): Promise<
  { id: string; name: string; slug: string; description?: string; image?: string; categoryIds: string[] }[]
> {
  try {
    const catalog = await getCatalog();
    const rows = (catalog.departments ?? []) as {
      id: string;
      name: string;
      slug: string;
      description?: string;
      image?: string;
      categoryIds?: string[];
      isActive?: boolean;
      sortOrder?: number;
    }[];
    return offeredRows(rows).map((row) => ({ ...row, categoryIds: row.categoryIds ?? [] }));
  } catch {
    return [];
  }
}
