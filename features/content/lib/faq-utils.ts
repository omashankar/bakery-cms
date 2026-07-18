import type { FaqCategory, FaqItem } from "@/types/content";
import type { EntityStatus } from "@/types/common";

export type FaqSort = "order" | "newest" | "question";

export interface FaqListFilters {
  search: string;
  category: FaqCategory | "all";
  status: EntityStatus | "all";
  sort: FaqSort;
}

export const defaultFaqFilters: FaqListFilters = {
  search: "",
  category: "all",
  status: "all",
  sort: "order",
};

export const faqCategoryOptions: Array<{ value: FaqCategory; label: string }> = [
  { value: "general", label: "General" },
  { value: "orders", label: "Orders" },
  { value: "wedding", label: "Wedding" },
  { value: "delivery", label: "Delivery" },
];

export function formatFaqCategory(category: FaqCategory): string {
  return faqCategoryOptions.find((item) => item.value === category)?.label ?? category;
}

export function filterFaqs(items: FaqItem[], filters: FaqListFilters): FaqItem[] {
  const query = filters.search.trim().toLowerCase();

  return items
    .filter((item) => {
      if (filters.category !== "all" && item.category !== filters.category) return false;
      if (filters.status !== "all" && item.status !== filters.status) return false;
      if (query) {
        const haystack = `${item.question} ${item.answer}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (filters.sort === "question") return a.question.localeCompare(b.question);
      if (filters.sort === "newest") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return a.sortOrder - b.sortOrder;
    });
}

export function formatFaqStatus(status: EntityStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function getFaqStatusVariant(
  status: EntityStatus
): "success" | "outline" | "secondary" {
  if (status === "published") return "success";
  if (status === "draft") return "outline";
  return "secondary";
}

export type FaqOverview = {
  total: number;
  published: number;
  draft: number;
  archived: number;
  byCategory: Record<FaqCategory, number>;
};

export function getFaqOverview(items: FaqItem[]): FaqOverview {
  const byCategory: Record<FaqCategory, number> = {
    general: 0,
    orders: 0,
    wedding: 0,
    delivery: 0,
  };

  for (const item of items) {
    byCategory[item.category] += 1;
  }

  return {
    total: items.length,
    published: items.filter((item) => item.status === "published").length,
    draft: items.filter((item) => item.status === "draft").length,
    archived: items.filter((item) => item.status === "archived").length,
    byCategory,
  };
}
