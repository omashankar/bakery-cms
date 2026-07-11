import type { ProductReview, ProductReviewOverview, ProductReviewStatus } from "@/types/review";

export interface ReviewListFilters {
  search: string;
  status: ProductReviewStatus | "all";
  rating: "all" | "5" | "4" | "3" | "2" | "1";
  cakeSlug: string;
  featuredOnly: boolean;
  reportedOnly: boolean;
}

export const defaultReviewFilters: ReviewListFilters = {
  search: "",
  status: "all",
  rating: "all",
  cakeSlug: "",
  featuredOnly: false,
  reportedOnly: false,
};

const statusLabels: Record<ProductReviewStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  reported: "Reported",
};

export function formatReviewStatus(status: ProductReviewStatus): string {
  return statusLabels[status];
}

export function getReviewStatusTone(
  status: ProductReviewStatus
): "neutral" | "warning" | "positive" | "destructive" {
  switch (status) {
    case "approved":
      return "positive";
    case "pending":
      return "warning";
    case "reported":
      return "destructive";
    case "rejected":
      return "neutral";
    default:
      return "neutral";
  }
}

export function filterReviews(
  reviews: ProductReview[],
  filters: ReviewListFilters
): ProductReview[] {
  const search = filters.search.trim().toLowerCase();

  return reviews.filter((review) => {
    if (filters.status !== "all" && review.status !== filters.status) return false;
    if (filters.rating !== "all" && review.rating !== Number(filters.rating)) return false;
    if (filters.cakeSlug && review.cakeSlug !== filters.cakeSlug) return false;
    if (filters.featuredOnly && !review.isFeatured) return false;
    if (filters.reportedOnly && review.status !== "reported") return false;

    if (!search) return true;

    return (
      review.authorName.toLowerCase().includes(search) ||
      review.cakeName.toLowerCase().includes(search) ||
      review.body.toLowerCase().includes(search) ||
      review.title?.toLowerCase().includes(search) ||
      review.adminReply?.toLowerCase().includes(search) ||
      review.reportReason?.toLowerCase().includes(search)
    );
  });
}

export function getReviewOverview(reviews: ProductReview[]): ProductReviewOverview {
  const approved = reviews.filter((review) => review.status === "approved");
  const averageRating =
    approved.length > 0
      ? approved.reduce((sum, review) => sum + review.rating, 0) / approved.length
      : 0;

  return {
    total: reviews.length,
    pending: reviews.filter((review) => review.status === "pending").length,
    approved: approved.length,
    rejected: reviews.filter((review) => review.status === "rejected").length,
    reported: reviews.filter((review) => review.status === "reported").length,
    featured: reviews.filter((review) => review.isFeatured).length,
    averageRating: Math.round(averageRating * 10) / 10,
  };
}

export function countActiveReviewFilters(filters: ReviewListFilters): number {
  let count = 0;
  if (filters.status !== "all") count += 1;
  if (filters.rating !== "all") count += 1;
  if (filters.cakeSlug) count += 1;
  if (filters.featuredOnly) count += 1;
  if (filters.reportedOnly) count += 1;
  return count;
}

export function getRatingSummary(reviews: ProductReview[]): Record<number, number> {
  const summary: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const review of reviews.filter((item) => item.status === "approved")) {
    summary[review.rating] = (summary[review.rating] ?? 0) + 1;
  }
  return summary;
}
