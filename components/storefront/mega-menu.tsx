"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { MegaMenuLink } from "@/constants/storefront-nav";
import type { MegaMenuGroup } from "@/types/site-layout";
import { navIcon } from "@/config/nav-icons";
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
 * What a shop with NO categories of its own gets.
 *
 * It used to be the demo bakery list — Birthday Cakes, Photo Cakes, Eggless
 * Cakes, Seasonal — with only the first row relabelled. Every one of those
 * is a promise this file cannot keep: the slug has to exist in the shop's
 * catalogue or the row opens an empty grid, and a florist with no categories
 * yet was offered five cake pages.
 *
 * Now ONE row that is true for any shop: everything, pointing at the
 * collections page itself, which renders whatever the shop has.
 *
 * There were two. The second was "Best Sellers" at `?sort=popular` — and the
 * collections page never reads `searchParams`, while its default sort is
 * already `popular`, so the two rows were the same page under two names. A
 * menu offering one destination twice is the shape of thing this file keeps
 * being fixed for.
 *
 * This is reachable for the first time: the server used to substitute the
 * demo taxonomy before an empty list could ever reach here.
 */
function useFallbackCategories(): MegaMenuLink[] {
  const labels = useBusinessLabels();
  return [
    { label: `All ${labels.productWordPlural}`, href: routes.store.collections },
  ];
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

/** One entry in the shop's own occasion list, as the server resolved it. */
export interface ShopOccasion {
  id: string;
  name: string;
  slug: string;
}

interface MegaMenuProps {
  isActive?: boolean;
  /** Where the menu's own trigger goes — this nav row's href. */
  href?: string;
  /** The shop's real categories. Falls back to the two generic rows if absent. */
  categories?: ShopCategory[];
  /**
   * The shop's real occasions.
   *
   * This column was three hardcoded bakery entries. Absent or empty now hides
   * the column outright rather than substituting a guess — a shop that keeps
   * no occasions has nothing to put there, and a heading over invented links
   * is worse than no heading.
   */
  occasions?: ShopOccasion[];
  /**
   * THE SHOP'S OWN COLUMNS, when it has written any.
   *
   * The menu was two fixed columns headed "Shop by Category" and "Shop by
   * Occasion". A shop could change what was IN them and nothing else — not
   * what they were called, not how many there were, not which nav item they
   * hung from. So a shop wanting "Cakes By Flavour" beside "Cakes By Theme"
   * under a CAKES item, and a different set under GIFTS, had no way to say so.
   *
   * Absent — the common case, and every shop on the day this shipped — falls
   * back to the taxonomy columns below, unchanged.
   */
  groups?: MegaMenuGroup[];
  /**
   * The label from the admin's Collections nav row. It read "Shop",
   * hardcoded, while the editor offered a label field for that row and a
   * visibility switch — neither of which reached this component.
   */
  label?: string;
  /**
   * THE THREE THINGS A ROW LOST BY GAINING A MENU.
   *
   * The admin offers Highlight, Icon and Badge on EVERY nav row, with no
   * hint that a row behaves differently once it has groups — and the navbar
   * passed none of them here, so the moment a shop gave its promoted row a
   * dropdown, its emphasis, its icon and its badge silently went. The
   * reference layout's first item is a highlighted category, which is
   * exactly the row a shop is most likely to give a menu.
   */
  highlight?: boolean;
  icon?: string;
  badge?: string;
  /**
   * Which edge of the trigger the panel hangs from.
   *
   * The panel is 640px and was always `left-0`. The band appears at lg,
   * where the content column is 960px — so any trigger more than 320px
   * along, which is the fourth row of a seven-row nav, pushed the panel past
   * the window and gave the whole storefront a horizontal scrollbar.
   */
  align?: "left" | "right";
}

/**
 * The groups worth drawing: visible, in order, and holding something.
 *
 * A heading over an empty list reads as something that failed to load — the
 * same rule the Occasion column and every filter box now follow.
 */
export function drawableGroups(groups?: MegaMenuGroup[]): MegaMenuGroup[] {
  return [...(groups ?? [])]
    .filter((group) => group.isVisible !== false && group.links.length > 0)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

/**
 * The row's icon as an ELEMENT, not as a component held in a variable.
 *
 * `const RowIcon = navIcon(icon)` in the component body is what the navbar
 * does inside its map, and it reads fine — but at component scope
 * `react-hooks/static-components` cannot tell a lookup in a fixed map from a
 * component defined during render, and reports it. This is the same lookup,
 * one call deeper, where the question does not arise.
 */
function rowIcon(name?: string) {
  const Icon = navIcon(name);
  return Icon ? <Icon className="size-4" /> : null;
}

export function MegaMenu({
  isActive,
  label = "Shop",
  categories: shopCategories,
  occasions: shopOccasions,
  groups,
  href = routes.store.collections,
  highlight,
  icon,
  badge,
  align = "left",
}: MegaMenuProps) {
  const authored = drawableGroups(groups);
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
  const occasions = filterWedding(
    (shopOccasions ?? []).map((occasion) => ({
      label: occasion.name,
      // The same route a category slug resolves through — an occasion tag
      // has always matched at /store/collections/<slug>.
      href: routes.store.collection(occasion.slug),
    })),
  );
  // The first of the shop's own categories that has a picture. Nothing to show
  // is a real answer — the menu is complete without this card.
  const withPicture = (shopCategories ?? []).find((category) => category.image?.trim());
  const featured = withPicture?.image ? { ...withPicture, image: withPicture.image } : null;
  return (
    <div className="group relative">
      <Link
        // The ROW's own destination. This was always the collections page,
        // so a CAKES item and a GIFTS item would both have opened the same
        // page — the menu is per nav row now, and each row has its own.
        href={href}
        className={cn(
          /*
            UPPERCASE AND LETTER-SPACED, matching the plain rows beside it.

            The transform is CSS, not a change to the stored string — the
            label stays exactly what the shop typed in the Header screen, so
            nothing about this is lossy.

            Hover fills to cream-200 rather than cream-100, because the band
            behind it is cream-100 now and a hover the same colour as its
            own background is no hover at all.
          */
          "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium uppercase tracking-[0.08em] transition-premium",
          highlight
            ? "font-semibold text-bakery-700 hover:bg-cream-200"
            : isActive
              ? "bg-cream-200 text-bakery-700"
              : "text-muted-foreground hover:bg-cream-200 hover:text-foreground"
        )}
      >
        {rowIcon(icon)}
        {label}
        {badge ? (
          <span className="rounded-full bg-bakery-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-bakery-700">
            {badge}
          </span>
        ) : null}
        <ChevronDown className="size-3.5 transition-transform group-hover:rotate-180" />
      </Link>

      <div
        className={cn(
          /*
            NEVER WIDER THAN THE WINDOW, and hung from whichever edge keeps
            it inside. A fixed 640px pinned to `left-0` overflows the moment
            its trigger is more than 320px along the band — which at lg, with
            a seven-row nav, is the fourth row onwards.
          */
          "pointer-events-none invisible absolute top-full z-50 w-[min(640px,calc(100vw-2rem))] pt-2 opacity-0 transition-all group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100",
          align === "right" ? "right-0" : "left-0"
        )}
      >
        <div className="overflow-hidden rounded-xl border border-border bg-white p-6 shadow-sm">
          {authored.length > 0 ? (
            /*
              THE SHOP'S OWN COLUMNS.

              `auto-fit` rather than a fixed column count: a shop writes two
              groups or six, and a grid that assumes three leaves a hole or
              squeezes. The panel is a fixed 640px wide, so a minimum column
              keeps four groups from becoming four unreadable slivers — they
              wrap onto a second row instead.
            */
            <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
              {authored.map((group) => (
                <div key={group.id}>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.heading}
                  </p>
                  <ul className="space-y-2">
                    {group.links.map((link) => (
                      <li key={link.id}>
                        <Link
                          href={link.href}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-premium hover:bg-cream-100 hover:text-bakery-700"
                        >
                          {link.label}
                          {link.badge ? (
                            <span className="rounded-full bg-bakery-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-bakery-700">
                              {link.badge}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
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
            {/* Hidden entirely when the shop keeps no occasions — a heading
                over an empty list reads as something that failed to load. */}
            {occasions.length > 0 ? (
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
            ) : null}
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
                  {/*
                    "Browse our <name>." went from here — a sentence this CMS
                    composed and presented as the shop's, with no field behind
                    it and no way to remove it. The card already carries the
                    category's name and its picture, and the whole thing is a
                    link; nothing is lost by not narrating it.
                  */}
                  <p className="text-sm font-semibold">{featured.name}</p>
                </div>
              </Link>
            ) : null}
          </div>
          )}
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
  occasions: shopOccasions,
  groups,
}: {
  onNavigate?: () => void;
  label?: string;
  categories?: ShopCategory[];
  occasions?: ShopOccasion[];
  /** The shop's own columns, when it wrote any — see MegaMenu. */
  groups?: MegaMenuGroup[];
}) {
  const authored = drawableGroups(groups);
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
  /**
   * The same occasions the desktop menu shows.
   *
   * This component had no occasion column at all, so the two menus already
   * disagreed — and the phone is the one an Indian shop's customers actually
   * use. Adding it here rather than only fixing the desktop source is the
   * point: a menu that differs by screen size is two menus.
   */
  const occasions = filterWedding(
    (shopOccasions ?? []).map((occasion) => ({
      label: occasion.name,
      href: routes.store.collection(occasion.slug),
    })),
  );
  /**
   * The shop's own columns become the shop's own SECTIONS here.
   *
   * A phone has one column, so a group is a sub-heading with its links under
   * it — the same content, laid out the way a phone reads. Rendered ahead of
   * the taxonomy fallback below and instead of it, exactly as on desktop.
   */
  if (authored.length > 0) {
    return (
      <div className="space-y-1 border-t border-border pt-3">
        <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {authored.map((group) => (
          <div key={group.id}>
            <p className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
              {group.heading}
            </p>
            {group.links.map((link) => (
              <Link
                key={link.id}
                href={link.href}
                onClick={onNavigate}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-cream-100"
              >
                {link.label}
                {link.badge ? (
                  <span className="rounded-full bg-bakery-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-bakery-700">
                    {link.badge}
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        ))}
      </div>
    );
  }

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
      {occasions.length > 0 ? (
        <>
          <p className="px-3 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Shop by Occasion
          </p>
          {occasions.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-cream-100"
            >
              {item.label}
            </Link>
          ))}
        </>
      ) : null}
    </div>
  );
}
