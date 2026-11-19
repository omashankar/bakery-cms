import { routes } from "@/constants/routes";
import { offeredAxes } from "@/features/catalog/lib/catalog-utils";
import { defaultHeaderSettings, selectVisibleNavItems } from "@/features/site-layout/lib/header-utils";
import { navRowOpensNothing, resolveNavMenus } from "@/features/site-layout/lib/menu-links";
import type { HeaderSettings } from "@/types/site-layout";

/**
 * THE HEADER'S TOP ROW, AS DATA — for the phone app's row of icon tabs.
 *
 * The website's header lives at the admin-only `/api/site-layout/header`, and
 * what it SHOWS is decided in two places this file restates against the same
 * inputs: `getStorefrontChrome` (resolve each row's menu against the offered
 * catalogue, then `selectVisibleNavItems`) and the navbar's own `bandRows`
 * (Home is left out — the logo is the way home — and so is a row
 * `navRowOpensNothing` drops). So a row the shop switched off, a menu-only row
 * whose menu has emptied, and the Home row are absent here exactly as they are
 * absent from the band.
 *
 * Pure: no database, no React, nothing from `apps/*` (domainStaysPure).
 */

/** One tab: the row's own words and address, and a picture when one is known. */
export interface StorefrontHomeMenuItem {
  label: string;
  href: string;
  /**
   * The picture of the group the row opens — a nav row has no picture of its
   * own (its `icon` is a name from a six-icon allowlist, not an image), so it
   * is the linked collection's, category's, occasion's or department's, or
   * null when the row opens a page, the whole catalogue or another site.
   */
  imageUrl: string | null;
}

interface PicturedRow {
  id: string;
  slug: string;
  name: string;
  image?: string;
  isActive?: boolean;
  sortOrder?: number;
}

/** The catalogue as `getCatalog` returns it — only what a menu needs. */
export interface StorefrontMenuCatalog {
  categories?: readonly PicturedRow[];
  occasions?: readonly PicturedRow[];
  collections?: readonly (PicturedRow & { productIds?: string[] })[];
  departments?: readonly (PicturedRow & { categoryIds?: string[] })[];
}

/** What `offeredAxes` hands back for these rows. */
interface OfferedRows {
  categories: readonly PicturedRow[];
  occasions: readonly PicturedRow[];
  collections: readonly PicturedRow[];
  departments: readonly PicturedRow[];
}

function pictureOf(rows: readonly PicturedRow[], slug: string): string | null {
  const image = rows.find((row) => row.slug === slug)?.image?.trim() ?? "";
  return image || null;
}

/**
 * The picture behind a header address, resolved the way the route does:
 * `/store/collections/<slug>` is a COLLECTION first, then a category (the
 * page resolves the collection first), `/store/occasions/<slug>` an occasion
 * and `/store/departments/<slug>` a department. Only rows the shop is
 * OFFERING — the same set the header's menus are resolved against.
 */
function imageFor(href: string, offered: OfferedRows): string | null {
  const path = href.trim().split(/[?#]/)[0].replace(/\/+$/, "");
  const [axis, slug, ...rest] = path
    .slice(routes.store.home.length)
    .split("/")
    .filter(Boolean);
  if (!path.startsWith(`${routes.store.home}/`) || !slug || rest.length > 0) return null;
  const decoded = (() => {
    try {
      return decodeURIComponent(slug);
    } catch {
      return slug;
    }
  })();
  switch (axis) {
    case "collections":
      return pictureOf(offered.collections, decoded) ?? pictureOf(offered.categories, decoded);
    case "occasions":
      return pictureOf(offered.occasions, decoded);
    case "departments":
      return pictureOf(offered.departments, decoded);
    default:
      return null;
  }
}

/**
 * The top-level rows the website's header band draws, in the shop's order.
 *
 * `header` is the stored header document — null when it could not be read,
 * which sends no tabs rather than the shipped demo rows. Merged over the
 * defaults the way `getStorefrontChrome` merges it, so a document stored
 * before `nav` existed shows the same rows on both.
 */
export function storefrontMenuFrom(
  header: Partial<HeaderSettings> | null | undefined,
  catalog: StorefrontMenuCatalog,
): StorefrontHomeMenuItem[] {
  if (!header) return [];
  const merged: HeaderSettings = { ...defaultHeaderSettings, ...header };
  const offered = offeredAxes<PicturedRow, PicturedRow, PicturedRow, PicturedRow>({
    categories: catalog.categories ?? [],
    occasions: catalog.occasions ?? [],
    collections: catalog.collections ?? [],
    departments: catalog.departments ?? [],
  });
  const axes = {
    category: offered.categories,
    occasion: offered.occasions,
    collection: offered.collections,
  };

  return selectVisibleNavItems(resolveNavMenus(merged.nav ?? [], axes))
    .filter((item) => item.href !== routes.store.home)
    .filter((item) => !navRowOpensNothing(item))
    .map((item) => ({
      label: item.label,
      href: item.href,
      imageUrl: imageFor(item.href, offered),
    }));
}
