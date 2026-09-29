/** One link inside a mega-menu group. */
export interface MegaMenuLinkItem {
  id: string;
  label: string;
  /** Anything the storefront can route to — a category, a collection, a page. */
  href: string;
  /** An optional word beside it: "New", "2 Hour", "Bestseller". */
  badge?: string;
  /**
   * WHICH CATALOGUE ROW THIS LINK IS, when the shop picked it instead of
   * typing it.
   *
   * `label` and `href` above are frozen strings and NOTHING in this repository
   * fixes them up: `updateCategory` merges a patch and writes,
   * `deleteCategories` filters the array and writes, and neither tells any
   * consumer. So a hand-typed menu says "Cream Cakes" for ever after the shop
   * renames it to "Fresh Cream", and opens an empty grid after the shop
   * deletes it — the defect the taxonomy columns were just fixed for,
   * reintroduced through a different door.
   *
   * With this set the server replaces `label` and `href` from the live row on
   * every render, and DROPS the link when the row is gone. The two strings
   * stay stored as a record of what was picked, so an unresolved link can
   * still say which row it meant.
   *
   * AN ID AND NOT A SLUG: a slug is what a shop edits when it rewrites a
   * page's address, and this has to survive that. The axis travels with it
   * because a category and a collection share /store/collections/<slug> while
   * an occasion has its own address — conflating those two was a real shipped
   * bug, recorded in components/storefront/mega-menu.tsx.
   *
   * OPTIONAL, and absent on every link in every shop today: a link without it
   * is exactly the link it has always been.
   */
  ref?: MenuLinkRef;
}

/** A pointer at one row of one of the three catalogue axes. */
export interface MenuLinkRef {
  axis: "category" | "occasion" | "collection";
  id: string;
}

/**
 * One HEADING and the links under it, inside one nav item's mega menu.
 *
 * "Cakes By Flavour", "Cakes By Theme", "Gifts For Him" — the column headings
 * a shop writes for itself. The menu was two fixed columns, Category and
 * Occasion, hardcoded in the component: a shop could change what was IN them
 * and not what they were called, how many there were, or which nav item they
 * hung from.
 */
export interface MegaMenuGroup {
  id: string;
  heading: string;
  sortOrder: number;
  isVisible: boolean;
  links: MegaMenuLinkItem[];
}

export interface HeaderNavItem {
  id: string;
  label: string;
  href: string;
  isVisible: boolean;
  sortOrder: number;
  /**
   * This row's own mega menu, when the shop has written one.
   *
   * ABSENT IS NOT EMPTY. A row with no `menu` is a plain link, exactly as
   * every row was before this existed — and the Collections row with no menu
   * keeps the taxonomy columns it has always drawn, or every shop's header
   * would empty out on the day this shipped.
   *
   * Optional rather than defaulted for the same reason: `[]` would mean "a
   * menu with nothing in it", which is a thing a shop can deliberately have.
   */
  menu?: MegaMenuGroup[];
  /**
   * Drawn in the brand colour rather than as ordinary nav text.
   *
   * The reference header leads with EXPRESS in the brand's own red. A shop
   * gets one or two of these at most — it is emphasis, and emphasis on
   * everything is emphasis on nothing — but which one is the shop's call,
   * not a developer's.
   */
  highlight?: boolean;
  /**
   * An icon beside the label, by NAME from a small allowlist.
   *
   * A name and not a component, because this crosses the wire from MongoDB
   * and is typed by an admin. An unknown name renders no icon rather than
   * throwing the header of every storefront page.
   */
  icon?: string;
  /** A short word beside the label — "New", "2 Hour". */
  badge?: string;
  /**
   * A separator drawn BEFORE this row.
   *
   * The reference puts the promoted "2 Hour Delivery Gifts" item behind a
   * divider, apart from the eleven category rows. It is a property of the
   * row rather than a row of its own so that hiding or reordering the item
   * takes its divider with it — a separate "divider" row would be left
   * floating.
   */
  dividerBefore?: boolean;
  /**
   * THIS ROW IS A MENU AND NOTHING ELSE.
   *
   * A reference header's category rows carry no destination of their own:
   * CAKES is not a page, it is the thing that opens the cake menu. The row
   * says what it IS, and `href` above stays REQUIRED beside it. Three
   * reasons, all of them lines already on disk:
   *
   * An OPTIONAL `href` makes "absent" mean both "deliberately menu-only" and
   * "this document is malformed", and the validator can then no longer refuse
   * the second — backup restore posts a hand-editable file to that endpoint.
   *
   * An optional `href` also throws every storefront page: the navbar's
   * `collectionsRow` lookup misses, `bandRows` keeps the row, neither menu
   * branch claims it, and it lands on `<Link href={undefined}>`. `next/link`
   * requires `href`, and this header renders on every storefront and /account
   * route, cart and checkout included.
   *
   * An EMPTY-STRING `href` makes `pathname.startsWith(item.href)` true on
   * every page, so every marked row renders as the active one at once.
   *
   * So the destination is KEPT and inert: switch this off and the row's own
   * page is still there. THE FLAG WINS wherever the two disagree, reconciled
   * in exactly one place — `navRowOpensNothing` in
   * features/site-layout/lib/menu-links.ts.
   *
   * Optional and absent on every row in every shop today — probed, not
   * assumed: a row without it is exactly the row it has always been.
   */
  menuOnly?: boolean;
}

export interface HeaderSettings {
  logoLetter: string;
  showSearch: boolean;
  /**
   * What the header's search box says before anyone types.
   *
   * Blank falls back to the shop's own plural — "Search products…" — which
   * is right and generic and says nothing about what is in the shop. The
   * reference header sells the catalogue in that line: "Search 5000+
   * flowers, cakes, gifts etc". Only the shop can write that, because only
   * the shop knows whether it has 5,000 of anything.
   */
  searchPlaceholder?: string;
  /*
    THE CTA BUTTON AND THE TOP ROW ARE GONE, at the shop's request:
    `showCta`, `ctaLabel`, `ctaHref`, `utilityNav` and `showCurrencyNote`.

    Both were LIVE when they went — an "Order Inquiry" button beside the cart
    and a thin row reading "Currency · INR". Neither is offered any more and
    neither can be turned back on from the admin.

    A document stored before today still HAS all five: the header is one
    Mongoose `Mixed` field and the schema is `.passthrough()`. They are dropped
    on the way in by a transform in site-layout.validators, so the next save
    cleans the document instead of writing them back, and restoring an old
    backup still succeeds rather than failing.
  */
  /**
   * The promo strip ABOVE the header, which draws the shop's active banners.
   *
   * A switch because those banners already have a home: the Promo Banner
   * section on the homepage draws the same list, so on the page most
   * customers land on, a shop's offer was being shown TWICE — once above the
   * logo and once in the page. The strip also mounts after hydration and
   * pushes the whole page down as it appears.
   *
   * Defaults ON, because every shop running this today has it and turning it
   * off for them from here would be this software deciding their offer is
   * not worth the top of the page. Switched off, the banners keep rendering
   * in the section that was always meant to carry them.
   */
  showBannerStrip?: boolean;
  nav: HeaderNavItem[];
  updatedAt: string;
}

export interface FooterLinkItem {
  id: string;
  label: string;
  href: string;
}

export interface FooterColumnConfig {
  id: string;
  title: string;
  links: FooterLinkItem[];
}

export interface FooterSettings {
  showContact: boolean;
  showHours: boolean;
  showSocial: boolean;
  showMap: boolean;
  columns: FooterColumnConfig[];
  copyrightSuffix: string;
  updatedAt: string;
}
