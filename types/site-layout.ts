/** One link inside a mega-menu group. */
export interface MegaMenuLinkItem {
  id: string;
  label: string;
  /** Anything the storefront can route to — a category, a collection, a page. */
  href: string;
  /** An optional word beside it: "New", "2 Hour", "Bestseller". */
  badge?: string;
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
  showCta: boolean;
  ctaLabel: string;
  ctaHref: string;
  nav: HeaderNavItem[];
  /**
   * The thin row ABOVE the main bar — Help, Track Order, and whatever else
   * the shop wants within reach of every page.
   *
   * The same shape as `nav` on purpose: it is the same thing, in a different
   * place, and giving it its own type would mean a second editor, a second
   * validator and a second render for no difference a shop can name.
   *
   * Optional and EMPTY by default, so a shop that never opens the screen has
   * no second row — the header is exactly as it is today.
   */
  utilityNav?: HeaderNavItem[];
  /**
   * Whether the utility row prints the shop's currency.
   *
   * A READOUT, not a switcher. Currency is one shop-wide setting published
   * into a process-global locale, `formatCurrency` is synchronous across
   * hundreds of call sites, and the payment gateway takes rupees only — so a
   * control that appeared to change it would charge the customer in INR
   * anyway. Saying which currency the prices are in is true and useful; a
   * dropdown would be neither.
   */
  showCurrencyNote?: boolean;
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
