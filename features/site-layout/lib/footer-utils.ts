import { routes } from "@/constants/routes";
import type { FooterColumnConfig, FooterSettings } from "@/types/site-layout";

function nowIso(): string {
  return new Date().toISOString();
}

export const defaultFooterSettings: FooterSettings = {
  showContact: true,
  showHours: true,
  showSocial: true,
  showMap: true,
  copyrightSuffix: "All rights reserved.",
  columns: [
    {
      id: "col-quick",
      title: "Quick Links",
      links: [
        { id: "ql-1", label: "Home", href: routes.store.home },
        { id: "ql-2", label: "Collections", href: routes.store.collections },
        { id: "ql-3", label: "Wedding Cakes", href: routes.store.weddingCakes },
        { id: "ql-4", label: "Gallery", href: routes.store.gallery },
        { id: "ql-5", label: "FAQ", href: routes.store.faq },
      ],
    },
    {
      id: "col-company",
      title: "Company",
      links: [
        { id: "co-1", label: "About Us", href: routes.store.about },
        { id: "co-2", label: "Contact", href: routes.store.contact },
        { id: "co-3", label: "Privacy Policy", href: routes.store.privacy },
        { id: "co-4", label: "Terms of Service", href: routes.store.terms },
      ],
    },
  ],
  updatedAt: nowIso(),
};

export function createFooterColumn(title: string): FooterColumnConfig {
  return {
    id: `col-${Date.now()}`,
    title,
    links: [],
  };
}

export type FooterOverview = {
  columns: number;
  links: number;
  sectionsEnabled: number;
  sectionsTotal: number;
};

export function getFooterOverview(settings: FooterSettings): FooterOverview {
  const sectionFlags = [
    settings.showContact,
    settings.showHours,
    settings.showSocial,
    settings.showMap,
  ];
  return {
    columns: settings.columns.length,
    links: settings.columns.reduce((sum, column) => sum + column.links.length, 0),
    sectionsEnabled: sectionFlags.filter(Boolean).length,
    sectionsTotal: sectionFlags.length,
  };
}
