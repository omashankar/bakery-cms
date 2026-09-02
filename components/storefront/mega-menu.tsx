"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { shopMegaMenu, type MegaMenuLink } from "@/constants/storefront-nav";
import { routes } from "@/constants/routes";
import { SafeImage } from "@/components/shared/safe-image";
import { isStorefrontWeddingEnabled } from "@/apps/website/lib/settings";
import { SETTINGS_UPDATED_EVENT } from "@/features/settings/lib/settings-repository";
import { useBusinessLabels } from "@/hooks/use-business-labels";
import { cn } from "@/lib/utils";

/**
 * Wedding Cakes is bakery-only. Defaults to enabled so SSR/first paint matches
 * the bakery template, then drops wedding links after mount for other business
 * types (settings live in client localStorage).
 */
/**
 * The demo category list, with the one entry that names the SHOP’S GOODS
 * rather than a category renamed to whatever the shop calls them.
 *
 * This fallback renders only while a shop has no categories of its own — which
 * is exactly a brand-new non-bakery shop, the one that must not be shown a menu
 * reading “All Cakes”. Matched by href, like the admin nav, rather than by
 * position: the rest of the list is demo CATEGORY names and stays as written.
 */
function useFallbackCategories(): MegaMenuLink[] {
  const labels = useBusinessLabels();
  return shopMegaMenu.categories.map((category) =>
    category.href === routes.store.collections
      ? { ...category, label: `All ${labels.productWordPlural}` }
      : category,
  );
}

function useWeddingLinkFilter() {
  const [weddingEnabled, setWeddingEnabled] = useState(true);
  useEffect(() => {
    const sync = () => setWeddingEnabled(isStorefrontWeddingEnabled());
    sync();
    window.addEventListener(SETTINGS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_UPDATED_EVENT, sync);
  }, []);
  return (items: MegaMenuLink[]) =>
    weddingEnabled ? items : items.filter((item) => item.href !== routes.store.weddingCakes);
}

/** One entry in the shop's own category list, as the server resolved it. */
export interface ShopCategory {
  id: string;
  name: string;
  slug: string;
  /** The picture the shop uploaded for it, if any. */
  image?: string;
}

interface MegaMenuProps {
  isActive?: boolean;
  /** The shop's real categories. Falls back to the demo list only if absent. */
  categories?: ShopCategory[];
  /**
   * The label from the admin's Collections nav row. It read "Shop",
   * hardcoded, while the editor offered a label field for that row and a
   * visibility switch — neither of which reached this component.
   */
  label?: string;
}

export function MegaMenu({ isActive, label = "Shop", categories: shopCategories }: MegaMenuProps) {
  const filterWedding = useWeddingLinkFilter();
  const fallbackCategories = useFallbackCategories();
  const categories = filterWedding(
    shopCategories?.length
      ? shopCategories.map((category) => ({
          label: category.name,
          href: routes.store.collection(category.slug),
        }))
      : fallbackCategories,
  );
  const occasions = filterWedding(shopMegaMenu.occasions);
  // The first of the shop's own categories that has a picture. Nothing to show
  // is a real answer — the menu is complete without this card.
  const withPicture = (shopCategories ?? []).find((category) => category.image?.trim());
  const featured = withPicture?.image ? { ...withPicture, image: withPicture.image } : null;
  return (
    <div className="group relative">
      <Link
        href={routes.store.collections}
        className={cn(
          "inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-premium",
          isActive
            ? "bg-cream-100 text-bakery-700"
            : "text-muted-foreground hover:bg-cream-100 hover:text-foreground"
        )}
      >
        {label}
        <ChevronDown className="size-3.5 transition-transform group-hover:rotate-180" />
      </Link>

      <div className="pointer-events-none invisible absolute top-full left-0 z-50 w-[640px] pt-2 opacity-0 transition-all group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100">
        <div className="overflow-hidden rounded-xl border border-border bg-white p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[1fr_1fr_200px]">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Shop by Category
              </p>
              <ul className="space-y-2">
                {categories.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block rounded-md px-2 py-1.5 text-sm text-foreground transition-premium hover:bg-cream-100 hover:text-bakery-700"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Shop by Occasion
              </p>
              <ul className="space-y-2">
                {occasions.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="block rounded-md px-2 py-1.5 text-sm text-foreground transition-premium hover:bg-cream-100 hover:text-bakery-700"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            {/*
              A category the shop actually has, with a picture it actually
              uploaded — or no card.

              This was a fixed promo: "Seasonal Collection · Limited-edition
              flavours for this season", a stock photo of somebody else's cake,
              and a link to /store/collections/seasonal whether or not that
              category existed. It is the only part of this menu that was still
              inventing something after the category links were fixed.
            */}
            {featured ? (
              <Link
                href={routes.store.collection(featured.slug)}
                className="group/card overflow-hidden rounded-xl border border-border bg-cream-50"
              >
                {/*
                  The category image is a free-text box in Catalog → Categories
                  — an admin-typed URL on any host — so next/image is not usable
                  here: it renders only hosts allow-listed in next.config
                  remotePatterns, and an un-listed one throws the render of a
                  component that sits in the header of every storefront page.
                  Same reasoning as the admin-typed logo in storefront-navbar.
                */}
                <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                  <SafeImage
                    src={featured.image}
                    alt={featured.name}
                    className="transition-transform group-hover/card:scale-[1.02]"
                  />
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold">{featured.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Browse our {featured.name.toLowerCase()}.
                  </p>
                </div>
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function MobileShopLinks({
  onNavigate,
  // The mobile half of the same heading. It was hardcoded too, so the
  // Collections row's label changed the desktop menu and not this one.
  label = "Shop",
  categories: shopCategories,
}: {
  onNavigate?: () => void;
  label?: string;
  categories?: ShopCategory[];
}) {
  const filterWedding = useWeddingLinkFilter();
  const fallbackCategories = useFallbackCategories();
  const categories = filterWedding(
    shopCategories?.length
      ? shopCategories.map((category) => ({
          label: category.name,
          href: routes.store.collection(category.slug),
        }))
      : fallbackCategories,
  );
  return (
    <div className="space-y-1 border-t border-border pt-3">
      <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {categories.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-cream-100"
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
