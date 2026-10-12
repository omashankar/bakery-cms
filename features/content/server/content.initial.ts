import "server-only";

import { getContentVersioned } from "./content.service";

/**
 * What an admin's `GET /api/content/[key]` answers — the whole collection —
 * together with the version its `X-Content-Version` header carries, from ONE
 * read. For a server page that hands the collection to its screen: the version
 * is what keeps that screen's next save from reverting another device's edit.
 */
export async function readContentForAdmin<T>(key: "banners" | "testimonials" | "faq") {
  const { value, version } = await getContentVersioned(key);
  return { items: value as T, version };
}
