import { ok, created } from "@/lib/server/http/response";
import { withErrorHandler } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { requireRole } from "@/lib/server/auth/dal";
import { rateLimit } from "@/lib/server/http/rate-limit";
import { requestContext } from "@/lib/server/audit/audit-log";

import * as service from "./review.service";
import {
  submitReviewSchema,
  updateReviewSchema,
  deleteReviewsSchema,
} from "./review.validators";

const REVIEW_ROLES = ["owner", "admin"] as const;
type IdContext = { params: Promise<{ id: string }> };

export const listReviewsController = withErrorHandler(async (request: Request) => {
  const productSlug = new URL(request.url).searchParams.get("productSlug");
  // Public: approved reviews for one product (storefront). No slug → admin all.
  if (productSlug) {
    return ok(await service.getApprovedForProduct(productSlug), "Approved reviews");
  }
  await requireRole(...REVIEW_ROLES);
  return ok(await service.getReviews(), "Reviews");
});

export const submitReviewController = withErrorHandler(async (request: Request) => {
  const ctx = requestContext(request);

  // Unauthenticated, and every submission lands in the moderation queue. Without
  // a limit one script can bury a shop's real reviews under thousands of rows —
  // the codebase has this helper and applies it to login and password reset,
  // which are the only other public write paths.
  rateLimit(`review:${ctx.ip}`, { limit: 5, windowMs: 60_000 });

  const input = validate(submitReviewSchema, await readJson(request));
  const review = await service.submitReview(input, ctx);
  return created(review, "Review submitted");
});

export const updateReviewController = withErrorHandler(async (request: Request, ctx: IdContext) => {
  const session = await requireRole(...REVIEW_ROLES);
  const { id } = await ctx.params;
  const patch = validate(updateReviewSchema, await readJson(request));
  const review = await service.updateReview(id, patch, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(review, "Review updated");
});

export const deleteReviewsController = withErrorHandler(async (request: Request) => {
  const session = await requireRole(...REVIEW_ROLES);
  const { ids } = validate(deleteReviewsSchema, await readJson(request));
  const deleted = await service.deleteReviews(ids, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok({ deleted }, "Reviews deleted");
});
