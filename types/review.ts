export type ProductReviewStatus = "pending" | "approved" | "rejected" | "reported";

export interface ProductReview {
  id: string;
  cakeId: string;
  productSlug: string;
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
  /**
   * The order this review was written about, resolved on the SERVER.
   *
   * Never taken from the submission. It is the whole basis of the line the
   * page prints beside the review, so a browser that could set it could
   * claim any city, and any purchase.
   */
  orderNumber?: string;
  /**
   * Where that order was actually delivered, stamped at the time.
   *
   * Copied rather than looked up on read: an address can be edited or the
   * order deleted, and a review that has been on the page for a year should
   * not silently start naming a different city — or stop naming one.
   */
  deliveredCity?: string;
  /**
   * Photos the reviewer attached, as URLs this shop's own uploader issued.
   *
   * Only ever URLs the server can find in its own upload ledger. A review is
   * a public, unauthenticated write, so an arbitrary remote URL here would
   * put anything at all — including a tracking pixel — on a product page,
   * loaded by every visitor.
   */
  photoUrls?: string[];
  /**
   * How many readers said this review helped them.
   *
   * A count, not a score: there is no way to say a review was UNhelpful,
   * because a button that buries what somebody wrote is a moderation tool
   * dressed as feedback and this shop already has a moderation screen.
   */
  helpfulCount?: number;
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
