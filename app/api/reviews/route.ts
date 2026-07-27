import {
  listReviewsController,
  submitReviewController,
  deleteReviewsController,
} from "@/features/reviews/server/review.controller";

export const GET = listReviewsController;
export const POST = submitReviewController;
export const DELETE = deleteReviewsController;
