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
}

export interface HeaderSettings {
  logoLetter: string;
  showSearch: boolean;
  showCta: boolean;
  ctaLabel: string;
  ctaHref: string;
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
