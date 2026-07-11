export type ProductReviewStatus = "pending" | "approved" | "rejected" | "reported";

export interface ProductReview {
  id: string;
  cakeId: string;
  cakeSlug: string;
  cakeName: string;
  authorName: string;
  authorEmail?: string;
  rating: number;
  title?: string;
  body: string;
  status: ProductReviewStatus;
  isFeatured: boolean;
  adminReply?: string;
  repliedAt?: string;
  reportReason?: string;
  orderNumber?: string;
  createdAt: string;
  updatedAt: string;
}

export type ProductReviewFormData = Omit<ProductReview, "id" | "createdAt" | "updatedAt">;

export interface ProductReviewOverview {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  reported: number;
  featured: number;
  averageRating: number;
}
