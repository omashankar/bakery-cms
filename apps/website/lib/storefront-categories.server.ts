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
  { id: string; name: string; slug: string }[]
> {
  try {
    const catalog = await getCatalog();
    const rows = (catalog.categories ?? []) as { id: string; name: string; slug: string }[];
    return rows.length > 0 ? dedupeBySlug(rows) : demoCategories;
  } catch {
    return demoCategories;
  }
}

/** First row wins, and a row with no slug is not a category anyone can reach. */
function dedupeBySlug(
  rows: { id: string; name: string; slug: string }[],
): { id: string; name: string; slug: string }[] {
  const bySlug = new Map<string, { id: string; name: string; slug: string }>();
  for (const { id, name, slug } of rows) {
    if (slug && !bySlug.has(slug)) bySlug.set(slug, { id, name, slug });
  }
  return [...bySlug.values()];
}
