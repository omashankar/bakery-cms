export interface HeaderNavItem {
  id: string;
  label: string;
  href: string;
  isVisible: boolean;
  sortOrder: number;
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
