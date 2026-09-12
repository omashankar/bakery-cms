import { getCatalog } from "@/features/catalog/server/catalog.service";
import { categories as demoCategories } from "@/constants/landing-data";

/**
 * The shop's own product categories, for the storefront's category pills.
 *
 * The pills were the shipped demo taxonomy from landing-data, so a category the
 * shop added had no pill and could only be reached by typing its URL, a renamed
 * one still showed its old name, and a deleted one kept a pill leading nowhere.
 *
 * Falls back to the demo list only when the catalogue cannot be read at all —
 * a storefront with no way to browse by category is worse than one browsing by
 * the wrong names, and an empty catalogue section is not the same as a
 * database that is down.
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
    return rows.length > 0 ? dedupeBySlug(rows) : demoCategories;
  } catch {
    return demoCategories;
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
