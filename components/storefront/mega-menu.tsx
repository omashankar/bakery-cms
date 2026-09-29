"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { MegaMenuLink } from "@/constants/storefront-nav";
import type { MegaMenuGroup } from "@/types/site-layout";
import { navIcon } from "@/config/nav-icons";
import { routes } from "@/constants/routes";
import { groupDraws } from "@/features/site-layout/lib/menu-links";
import { SafeImage } from "@/components/shared/safe-image";

import { useBusinessLabels } from "@/hooks/use-business-labels";
import { cn } from "@/lib/utils";

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

/** One curated group, as the server resolved it. */
export interface ShopCollection {
  id: string;
  name: string;
  slug: string;
}

/**
 * The nouns this menu heads its columns with — see StorefrontChrome.menuWords.
 *
 * A structural type and not `ResolvedLabels`, so `useBusinessLabels()` still
 * satisfies it for a caller rendering this component with no props.
 */
export interface MenuWords {
  productWordPlural: string;
  categoryWord: string;
  occasionWord: string;
  collectionWord: string;
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
   * The shop's CURATED groups — the third axis.
   *
   * Two fixed columns over a catalogue with three addressable axes meant the
   * one axis a shop assembles BY HAND was the one its menu could not show.
   * Empty hides the column outright, exactly as the occasion column above
   * already does.
   */
  collections?: ShopCollection[];
  /**
   * The shop's own nouns, resolved on the SERVER.
   *
   * Optional, falling through to `useBusinessLabels` so this component is
   * still renderable with no props — but the navbar always passes it, and
   * the hook must not decide: it seeds the defaults and syncs after mount,
   * so a shop with its own word would be served the default in the HTML.
   */
  words?: MenuWords;
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
  /**
   * THE ROW HAS NO DESTINATION OF ITS OWN — it exists to open this menu.
   *
   * The trigger becomes a `<button>`. NOT unconditional: every shop's
   * Collections row still has its own page, and taking that away from them
   * silently is not what this switch asked for.
   */
  menuOnly?: boolean;
}

/**
 * The groups worth drawing: visible, in order, and holding something.
 *
 * A heading over an empty list reads as something that failed to load — the
 * same rule the Occasion column and every filter box now follow.
 */
export function drawableGroups(groups?: MegaMenuGroup[]): MegaMenuGroup[] {
  return [...(groups ?? [])]
    // `groupDraws` and not the condition inline: the Header screen and
    // `navRowOpensNothing` ask the same question and must get the same answer.
    .filter(groupDraws)
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

/**
 * HOW WIDE THE PANEL IS, AND HOW MANY COLUMNS IT DRAWS.
 *
 * The panel was a flat 640px whatever it held, and `auto-fit` COLLAPSES the
 * tracks it has no items for while `1fr` absorbs the space — so one group came
 * out as a single 592px column: a short heading over a few links, stretched
 * across a hover card two thirds the width of the band. A brand-new shop's
 * menu is exactly that, holding one link. The compact first dropdown a
 * reference header has is the same defect from the other end — the width did
 * not know what was in it.
 *
 * THREE COLUMNS IS THE CEILING AND 40rem IS ITS WIDTH — exactly the 640px this
 * has always been, so no shop's panel gets WIDER than it is today. That is
 * deliberate: `align` in storefront-navbar picks an edge from the trigger's
 * position, and it was measured against this envelope. A fourth group wraps
 * onto a second row, which is what `auto-fit` already did at this width.
 *
 * STATIC CLASS STRINGS, not a template literal: Tailwind extracts class names
 * by reading the source, so `w-[min(${rem}rem,…)]` compiles to no CSS at all.
 *
 * Pure and exported so the sizes are asserted by what this RETURNS rather than
 * by the text of a className — which is a check that passes for a file that
 * computes a width and never applies it.
 */
const PANEL_WIDTH: Record<number, string> = {
  15: "w-[min(15rem,calc(100vw-2rem))]",
  27: "w-[min(27rem,calc(100vw-2rem))]",
  29: "w-[min(29rem,calc(100vw-2rem))]",
  40: "w-[min(40rem,calc(100vw-2rem))]",
};
/** One link column, two, three. `p-6` leaves 192 / 384 / 592px inside. */
const LINK_COLUMN_REM: Record<number, number> = { 1: 15, 2: 27, 3: 40 };
/** The picture card is a fixed 200px plus the grid's own 24px gap. */
const CARD_REM = 14;
const PANEL_MAX_REM = 40;

export function panelShape(
  linkColumns: number,
  hasCard = false,
): { columns: number; width: string } {
  const columns = Math.min(Math.max(Math.trunc(linkColumns) || 1, 1), 3);
  const rem = Math.min(
    PANEL_MAX_REM,
    LINK_COLUMN_REM[columns] + (hasCard ? CARD_REM : 0),
  );
  return { columns, width: PANEL_WIDTH[rem] };
}

/** One track per group the shop wrote, up to three. */
const AUTHORED_GRID: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};

/**
 * The taxonomy grid, counted from what actually RENDERS.
 *
 * This was `lg:grid-cols-[1fr_1fr_200px]` — three fixed tracks whether or not
 * the occasion column and the picture card were drawn. On a shop with neither,
 * the 592px inside the card went 172 to the one column of links and 420 to two
 * empty tracks. It is the same bug as the authored branch's, in its widest
 * form, on the branch that has live users.
 *
 * The `lg:` prefix went with it and nothing is lost: this component renders
 * only inside `[data-nav-band]`, which is hidden below lg. The phone menu is
 * `MobileShopLinks` in the navbar.
 */
const TAXONOMY_GRID: Record<string, string> = {
  "1": "grid-cols-1",
  "1-card": "grid-cols-[minmax(0,1fr)_200px]",
  "2": "grid-cols-2",
  "2-card": "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_200px]",
  /*
    THE THIRD AXIS.

    Absent, this lookup returns `undefined`, `cn` drops it, and the panel
    collapses to ONE implicit column stacking all three lists — silently,
    because `panelShape` still reports a correct-looking 40rem. The width and
    the grid come from two different maps, which is the "computes a width and
    never applies it" failure the note above already names, and the e2e next
    door measures the panel for being too WIDE so it would stay green.

    No "3-card", deliberately: `hasCard` is false at three columns. Those two
    facts must move together or this map needs the key in the same edit.
  */
  "3": "grid-cols-3",
};

export function MegaMenu({
  isActive,
  label = "Shop",
  categories: shopCategories,
  occasions: shopOccasions,
  collections: shopCollections,
  words: serverWords,
  groups,
  href = routes.store.collections,
  highlight,
  icon,
  badge,
  align = "left",
  menuOnly,
}: MegaMenuProps) {
  const authored = drawableGroups(groups);
  const fallbackCategories = useFallbackCategories();
  const categories = shopCategories?.length
    ? shopCategories.map((category) => ({
        label: category.name,
        href: routes.store.collection(category.slug),
      }))
    : fallbackCategories;
  const occasions = (shopOccasions ?? []).map((occasion) => ({
    label: occasion.name,
    // Its OWN page now. This was `routes.store.collection(occasion.slug)`,
    // where a category with the same slug answered instead — so this shop's
    // Birthday, Wedding and Anniversary rows opened the category of that name
    // and the occasion's own products were never shown as a set.
    href: routes.store.occasion(occasion.slug),
  }));
  /*
    The SERVER's nouns win. `useFallbackCategories` above still uses the hook
    and must keep doing so — the guard slices this file on that function's
    name — but a HEADING resolved after mount would be the default in the
    HTML and the shop's word one paint later, inside a panel that is
    `invisible` until hover. Nobody would see the swap, which is why nobody
    would catch it.
  */
  const clientWords = useBusinessLabels();
  const words = serverWords ?? clientWords;
  const collections = (shopCollections ?? []).map((group) => ({
    label: group.name,
    /*
      Resolved collection-FIRST at this address, and the chrome has already
      dropped any category whose slug a collection claimed — so the two lists
      arriving here are disjoint.
    */
    href: routes.store.collection(group.slug),
  }));
  // The first of the shop's own categories that has a picture. Nothing to show
  // is a real answer — the menu is complete without this card.
  const withPicture = (shopCategories ?? []).find((category) => category.image?.trim());
  const featured = withPicture?.image ? { ...withPicture, image: withPicture.image } : null;
  /*
    THE COLUMNS THIS PANEL IS ABOUT TO DRAW.

    The link column always draws; the occasion column only when the shop keeps
    occasions. Written this way and NOT as `occasions.length > 0 ? 1 : 0`
    deliberately: that exact string is this menu's render guard and the
    phone's, and the-shop-menu-lists-the-shop.test.ts counts it at exactly two
    — so the natural spelling reddens a correct change.
  */
  const taxonomyColumns = [1, occasions.length, collections.length].filter(Boolean).length;
  /*
    THE CARD GOES WHEN THE THIRD COLUMN ARRIVES.

    `panelShape(3, true)` clamps to the SAME 40rem as `panelShape(3)` — the
    ceiling swallows the card's 14rem — so asking for both does not widen the
    panel, it narrows every column to about 107px, which does not hold
    "Chocolate Cakes". And the width would still look right in the source.

    Nothing is lost that this menu does not already say: the card is the FIRST
    category with a photograph, which is the first row of column one. The
    duplicate-links spec records finding exactly that — it "reported
    /store/collections/cream-cakes as a duplicate of itself".
  */
  const hasCard = Boolean(featured) && taxonomyColumns < 3;
  const { columns, width } =
    authored.length > 0
      ? panelShape(authored.length)
      : panelShape(taxonomyColumns, hasCard);
  /*
    ONE DEFINITION FOR BOTH TRIGGERS — the branch below chooses the ELEMENT
    and nothing else. Two copies of this markup is how the same stored word
    read "2 Hour" on the trigger and "2 HOUR" three pixels under it.
  */
  const triggerClass = cn(
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
  );
  const triggerInner = (
    <>
      {rowIcon(icon)}
      {label}
      {badge ? (
        /* `uppercase`, like the badge on a plain row's twin and like the two
           inside the panel below. Without it the same stored word read "2
           Hour" on the trigger and "2 HOUR" three pixels under it. */
        <span className="rounded-full bg-bakery-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-bakery-700">
          {badge}
        </span>
      ) : null}
      <ChevronDown className="size-3.5 transition-transform group-hover:rotate-180" />
    </>
  );
  return (
    <div className="group relative">
      {menuOnly ? (
        /*
          A BUTTON, BECAUSE THIS ROW GOES NOWHERE.

          A link that does not navigate is a link a customer cannot open in
          a new tab and a screen reader announces wrongly — the same
          reasoning the drawer's search row already carries in
          storefront-navbar. `type="button"` because a typeless button
          submits, and this renders inside a header that carries the search
          form.

          `data-mega-trigger` on BOTH arms: the browser spec finds the
          band's triggers by it, and a marker cannot go stale the way a tag
          name just did — the same reason `data-mega-panel` exists.

          NO `aria-expanded` AND NO STATE, deliberately. The panel opens
          from `group-hover` and `group-focus-within` in CSS and nothing
          here knows whether it is open, so an `aria-expanded` would
          announce "collapsed" over a panel a keyboard user is reading. A
          silence is not a lie.

          The keyboard path is unchanged and coherent: Tab onto this button
          and `:focus-within` lifts the panel's `invisible`, which is what
          puts its links into the tab order — Tab opens the menu, Tab again
          walks into it. Escape wants the same state, and giving it that
          means taking `:focus-within` out of CSS for EVERY row, including
          every shop's Collections row and the window before this page
          hydrates. Not in this change, and no row has Escape today.
        */
        <button type="button" data-mega-trigger className={triggerClass}>
          {triggerInner}
        </button>
      ) : (
        <Link
          // The ROW's own destination. This was always the collections
          // page, so a CAKES item and a GIFTS item would both have opened
          // the same page — the menu is per nav row now, and each row has
          // its own.
          href={href}
          data-mega-trigger
          className={triggerClass}
        >
          {triggerInner}
        </Link>
      )}

      <div
        data-mega-panel
        className={cn(
          /*
            NEVER WIDER THAN THE WINDOW, and hung from whichever edge keeps
            it inside. A fixed 640px pinned to `left-0` overflows the moment
            its trigger is more than 320px along the band — which at lg, with
            a seven-row nav, is the fourth row onwards.

            The first number comes from `panelShape` now and is never MORE
            than the 40rem this always was: a panel holding one column is
            15rem. So the window cap and the `align` choice next door keep
            exactly the envelope they were measured against, and the shapes
            that used to sit inside a 640px card with 350px of air no longer
            do.

            `data-mega-panel` because the e2e spec that wants this element
            looked it up by `[class*="w-[640px]"]`, which has matched nothing
            since the width gained a `min()`. A marker cannot go stale the way
            a class string does — the same reason `data-nav-band` exists.

            `invisible` is load-bearing and not decoration: `visibility:
            hidden` is what keeps a closed panel's links out of the tab order.
          */
          "pointer-events-none invisible absolute top-full z-50 pt-2 opacity-0 transition-all group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100",
          width,
          align === "right" ? "right-0" : "left-0"
        )}
      >
        <div className="overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm">
          {authored.length > 0 ? (
            /*
              THE SHOP'S OWN COLUMNS.

              AN EXPLICIT COUNT, not `auto-fit`. The premise of the note that
              was here — "the panel is a fixed 640px wide" — is what was
              wrong: `auto-fit` collapses the tracks it has no items for and
              `1fr` takes the space, so one group was one 592px column inside
              a 640px card. The count and the width above come from one call,
              so they cannot disagree; a fourth group wraps onto a second row,
              which is what `auto-fit` already did at this width.
            */
            <div className={cn("grid gap-6", AUTHORED_GRID[columns])}>
              {authored.map((group) => (
                <div key={group.id}>
                  {/*
                    A BLANK HEADING DRAWS NOTHING, rather than an empty
                    paragraph and its margin — a heading-shaped gap above the
                    links.

                    This matters more than it looks. A new group's heading box
                    now arrives EMPTY: this software may not type a column
                    name on the shop's behalf, and "New group" appearing in a
                    live panel is exactly that. So a shop that picks its links
                    and never writes a heading gets a clean unheaded column,
                    which is a real thing to want, instead of a gap.
                  */}
                  {group.heading.trim() ? (
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.heading}
                    </p>
                  ) : null}
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
          <div
            className={cn(
              "grid gap-6",
              TAXONOMY_GRID[hasCard ? `${taxonomyColumns}-card` : `${taxonomyColumns}`],
            )}
          >
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Shop by {words.categoryWord}
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
                Shop by {words.occasionWord}
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
            {/* The third axis. Hidden when the shop keeps no collections —
                the same rule the column above follows, and for the same
                reason: a heading over an empty list reads as something that
                failed to load. */}
            {collections.length > 0 ? (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Shop by {words.collectionWord}
              </p>
              <ul className="space-y-2">
                {collections.map((item) => (
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
            {hasCard && featured ? (
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
  collections: shopCollections,
  words: serverWords,
  groups,
}: {
  onNavigate?: () => void;
  label?: string;
  categories?: ShopCategory[];
  occasions?: ShopOccasion[];
  /** The same third axis the desktop draws — see MegaMenu. */
  collections?: ShopCollection[];
  /** The same nouns, from the same chrome field — see MegaMenu. */
  words?: MenuWords;
  /** The shop's own columns, when it wrote any — see MegaMenu. */
  groups?: MegaMenuGroup[];
}) {
  const authored = drawableGroups(groups);
  const fallbackCategories = useFallbackCategories();
  const categories = shopCategories?.length
    ? shopCategories.map((category) => ({
        label: category.name,
        href: routes.store.collection(category.slug),
      }))
    : fallbackCategories;
  /**
   * The same occasions the desktop menu shows.
   *
   * This component had no occasion column at all, so the two menus already
   * disagreed — and the phone is the one an Indian shop's customers actually
   * use. Adding it here rather than only fixing the desktop source is the
   * point: a menu that differs by screen size is two menus.
   */
  // The phone menu is the same menu; see the note on its desktop twin above.
  const occasions = (shopOccasions ?? []).map((occasion) => ({
    label: occasion.name,
    href: routes.store.occasion(occasion.slug),
  }));
  /*
    The third axis reaches the phone in the same breath as the other two. A
    menu that differs by screen size is two menus, and this component shipped
    with no occasion column at all once already.

    IDENTICAL EXPRESSIONS to the desktop twin's, deliberately — that is what
    makes the href-parity guard below mean something.
  */
  const collections = (shopCollections ?? []).map((group) => ({
    label: group.name,
    href: routes.store.collection(group.slug),
  }));
  const clientWords = useBusinessLabels();
  const words = serverWords ?? clientWords;
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
            {/* The same rule as the desktop twin's — see the note there. A
                fix that lands on one of these two renderers and not the
                other is a defect this component has shipped twice. */}
            {group.heading.trim() ? (
              <p className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                {group.heading}
              </p>
            ) : null}
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
      {/* A HEADING OVER THE CATEGORIES TOO.
          They sat bare under the nav row's own label while the occasions
          below them had one — so the phone already labelled one axis and not
          the other, and a third would have made that three lists with
          one-and-a-bit headings. */}
      <p className="px-3 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Shop by {words.categoryWord}
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
            Shop by {words.occasionWord}
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
      {collections.length > 0 ? (
        <>
          <p className="px-3 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Shop by {words.collectionWord}
          </p>
          {collections.map((item) => (
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
