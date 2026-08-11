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
 */
export async function getStorefrontCategories(): Promise<
  { id: string; name: string; slug: string }[]
> {
  try {
    const catalog = await getCatalog();
    const rows = (catalog.categories ?? []) as { id: string; name: string; slug: string }[];
    return rows.length > 0 ? rows.map(({ id, name, slug }) => ({ id, name, slug })) : demoCategories;
  } catch {
    return demoCategories;
  }
}
