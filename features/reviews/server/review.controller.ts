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
  const input = validate(submitReviewSchema, await readJson(request));

  /**
   * Keyed on something the caller cannot rotate for free — the same rule the
   * login and password-reset throttles above were rewritten to.
   *
   * This was `ctx.ip` alone, and `ctx.ip` is "" on every deployment that has
   * not set TRUST_PROXY_HEADERS=true, which is the default. An empty string is
   * a CONSTANT, so the five-per-minute budget was not per visitor at all: it
   * was one bucket for the whole shop. Six people submitting in the same minute
   * meant the sixth got a 429, and on a busy Saturday the wedding form — where
   * this bakery's largest orders come from — simply stopped accepting anyone.
   *
   * The IP is still used when there IS one, as a second, narrower bucket.
   */
  rateLimit(`review:from:${input.authorEmail?.trim().toLowerCase() ?? input.productSlug}`, {
    limit: 5,
    windowMs: 60_000,
  });
  if (ctx.ip) rateLimit(`review:ip:${ctx.ip}`, { limit: 20, windowMs: 60_000 });
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
