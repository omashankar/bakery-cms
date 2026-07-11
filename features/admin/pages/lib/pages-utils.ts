import type { CmsPage } from "@/types/content";
import type { EntityStatus } from "@/types/common";
import { routes } from "@/constants/routes";

export type PageSort = "order" | "newest" | "title";

export interface PageListFilters {
  search: string;
  status: EntityStatus | "all";
  template: CmsPage["template"] | "all";
  sort: PageSort;
}

export const defaultPageFilters: PageListFilters = {
  search: "",
  status: "all",
  template: "all",
  sort: "order",
};

export function filterPages(pages: CmsPage[], filters: PageListFilters): CmsPage[] {
  const query = filters.search.trim().toLowerCase();

  return pages
    .filter((page) => {
      if (filters.status !== "all" && page.status !== filters.status) return false;
      if (filters.template !== "all" && page.template !== filters.template) return false;
      if (query) {
        const haystack = `${page.title} ${page.slug} ${page.description}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (filters.sort === "title") return a.title.localeCompare(b.title);
      if (filters.sort === "newest") {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      return a.sortOrder - b.sortOrder;
    });
}

export function formatPageStatus(status: EntityStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function getPageStatusVariant(
  status: EntityStatus
): "success" | "outline" | "secondary" {
  if (status === "published") return "success";
  if (status === "draft") return "outline";
  return "secondary";
}

export function getStorefrontPageUrl(slug: string): string {
  if (slug === "about") return routes.store.about;
  if (slug === "privacy") return routes.store.privacy;
  if (slug === "terms") return routes.store.terms;
  return routes.store.page(slug);
}

export function formatPageTemplate(template: CmsPage["template"]): string {
  return template === "about" ? "About layout" : "Standard";
}

export interface PageOverview {
  total: number;
  published: number;
  draft: number;
  archived: number;
  system: number;
}

export function getPageOverview(pages: CmsPage[]): PageOverview {
  return {
    total: pages.length,
    published: pages.filter((page) => page.status === "published").length,
    draft: pages.filter((page) => page.status === "draft").length,
    archived: pages.filter((page) => page.status === "archived").length,
    system: pages.filter((page) => page.isSystem).length,
  };
}
