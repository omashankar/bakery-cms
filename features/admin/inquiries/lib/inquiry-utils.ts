import type { Inquiry, InquiryStatus, InquiryType } from "@/types/inquiry";

export type InquirySort = "newest" | "oldest" | "name";
export type InquiryDateFilter = "all" | "7d" | "30d";

export interface InquiryListFilters {
  search: string;
  type: InquiryType | "all";
  status: InquiryStatus | "all";
  date: InquiryDateFilter;
  sort: InquirySort;
}

export const defaultInquiryFilters: InquiryListFilters = {
  search: "",
  type: "all",
  status: "all",
  date: "all",
  sort: "newest",
};

export function formatInquiryType(type: InquiryType): string {
  switch (type) {
    case "wedding":
      return "Wedding";
    case "contact":
      return "Contact";
    case "newsletter":
      return "Newsletter";
  }
}

export function formatInquiryStatus(status: InquiryStatus): string {
  switch (status) {
    case "new":
      return "New";
    case "in_progress":
      return "In Progress";
    case "replied":
      return "Replied";
    case "closed":
      return "Closed";
  }
}

export function getInquiryStatusVariant(
  status: InquiryStatus
): "destructive" | "warning" | "success" | "outline" {
  switch (status) {
    case "new":
      return "destructive";
    case "in_progress":
      return "warning";
    case "replied":
      return "success";
    default:
      return "outline";
  }
}

export function filterInquiries(
  inquiries: Inquiry[],
  filters: InquiryListFilters,
  fixedType?: InquiryType
): Inquiry[] {
  const query = filters.search.trim().toLowerCase();
  const now = Date.now();

  return inquiries
    .filter((inquiry) => {
      if (fixedType && inquiry.type !== fixedType) return false;
      if (!fixedType && filters.type !== "all" && inquiry.type !== filters.type) {
        return false;
      }
      if (filters.status !== "all" && inquiry.status !== filters.status) return false;
      if (filters.date !== "all") {
        const ageMs = now - new Date(inquiry.createdAt).getTime();
        const maxAge = filters.date === "7d" ? 7 : 30;
        if (ageMs > maxAge * 86400000) return false;
      }
      if (query) {
        const haystack = [
          inquiry.name,
          inquiry.email,
          inquiry.phone,
          inquiry.subject,
          inquiry.message,
          inquiry.notes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (filters.sort === "name") return a.name.localeCompare(b.name);
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return filters.sort === "newest" ? bTime - aTime : aTime - bTime;
    });
}

export function countInquiriesByStatus(
  inquiries: Inquiry[],
  status: InquiryStatus
): number {
  return inquiries.filter((inquiry) => inquiry.status === status).length;
}
