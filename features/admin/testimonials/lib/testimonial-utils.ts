import type { Testimonial } from "@/types/content";
import type { EntityStatus } from "@/types/common";

export type TestimonialSort = "newest" | "name" | "order";

export interface TestimonialListFilters {
  search: string;
  status: EntityStatus | "all";
  featured: "all" | "featured";
  sort: TestimonialSort;
}

export const defaultTestimonialFilters: TestimonialListFilters = {
  search: "",
  status: "all",
  featured: "all",
  sort: "order",
};

export function filterTestimonials(
  items: Testimonial[],
  filters: TestimonialListFilters
): Testimonial[] {
  const query = filters.search.trim().toLowerCase();

  return items
    .filter((item) => {
      if (filters.status !== "all" && item.status !== filters.status) return false;
      if (filters.featured === "featured" && !item.isFeatured) return false;
      if (query) {
        const haystack = `${item.name} ${item.role} ${item.content}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (filters.sort === "name") return a.name.localeCompare(b.name);
      if (filters.sort === "newest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return a.sortOrder - b.sortOrder;
    });
}

export function formatTestimonialStatus(status: EntityStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function getTestimonialStatusVariant(
  status: EntityStatus
): "success" | "outline" | "secondary" {
  if (status === "published") return "success";
  if (status === "draft") return "outline";
  return "secondary";
}

export type TestimonialOverview = {
  total: number;
  published: number;
  draft: number;
  archived: number;
  featured: number;
};

export function getTestimonialOverview(items: Testimonial[]): TestimonialOverview {
  return {
    total: items.length,
    published: items.filter((item) => item.status === "published").length,
    draft: items.filter((item) => item.status === "draft").length,
    archived: items.filter((item) => item.status === "archived").length,
    featured: items.filter((item) => item.isFeatured).length,
  };
}
