import { randomUUID } from "node:crypto";

import { createMongoStore } from "@/lib/server/db/cms-store";
import { writeAuditLog } from "@/lib/server/audit/audit-log";
import { NotFoundError } from "@/lib/server/http/errors";
import * as productRepo from "@/features/products/server/product.repository";
import * as orderRepo from "@/features/orders/server/order.repository";
import * as uploadRepo from "@/features/uploads/server/photo-upload.service";
import { getCustomerAccount } from "@/lib/server/auth/customer-dal";
import type { ProductReview } from "@/types/review";

import * as repo from "./review.repository";
import type { SubmitReviewInput, UpdateReviewInput } from "./review.validators";

interface RequestCtx {
  ip: string;
  userAgent: string;
  actorId?: string | null;
  actorEmail?: string;
}

/**
 * The demo seed that used to live here is GONE, names and all.
 *
 * It wrote invented reviews — “Priya Sharma”, “Rahul Mehta”, at @demo.com
 * addresses — into the shop’s real database, and the aggregate averaged them
 * onto its products as if customers had left them. A shop cannot tell which of
 * its reviews are real once they are in the same collection.
 */

const seededFlag = createMongoStore<{ done: boolean }>({
  key: "reviews-seeded",
  seed: () => ({ done: false }),
});

async function ensureSeeded(): Promise<void> {
  const flag = await seededFlag.read();
  if (flag.done) return;
  /**
   * NOTHING IS SEEDED. This wrote invented reviews under invented names, at
   * `@demo.com` addresses, into the shop’s real database the first time anyone
   * opened Reviews — and the aggregate then averaged them onto the shop’s own
   * products as if customers had left them.
   *
   * Worse for a shop’s OWN product: the first seeded review took
   * `Math.round(cake.rating)`, which is 0 for anything nobody has reviewed,
   * clamped up to 1 — so adding a product earned it a ONE-STAR review from a
   * customer who does not exist.
   *
   * The flag is still written, so a shop that already has the seeded rows
   * (ids `review-seed-*`) does not get them again; removing those is a data
   * job, not a code one.
   */
  await seededFlag.write({ done: true });
}

const aggregatesBackfilled = createMongoStore<{ done: boolean }>({
  key: "review-aggregates-backfilled",
  seed: () => ({ done: false }),
});

/**
 * One-time repair of the ratings shops are already advertising.
 *
 * Wiring the recompute into the write paths fixes every FUTURE moderation, and
 * reaches no shop that is already live — their products still carry whatever the
 * seed put there. Measured on a real shop: 14 of 14 sampled products advertised
 * a score no review supported, including "4.9★ from 124 reviews" on a cake with
 * none.
 *
 * Runs from the admin review list rather than a public read, so a stranger
 * cannot trigger a catalogue-wide write, and it is a flag read after the first
 * time.
 */
async function ensureAggregatesBackfilled(): Promise<void> {
  const flag = await aggregatesBackfilled.read();
  if (flag.done) return;

  for (const product of await productRepo.listAll()) {
    await refreshProductRating(product.slug);
  }
  await aggregatesBackfilled.write({ done: true });
}

/**
 * Bring a product's advertised rating back in line with its approved reviews.
 *
 * Every write to a review has to end here, because `rating` and `reviewCount`
 * live ON the product document and that is what the storefront renders.
 *
 * There WAS a version of this, `syncProductReviewAggregates` in the client
 * repository — it computed the right number and then wrote it to localStorage.
 * The server's product was never touched, so approving a review changed the
 * moderator's own screen and nothing else; measured against a real shop, all 14
 * sampled products advertised a score no review supported, one of them "4.9★
 * from 124 reviews" with no reviews at all. The moderator had no way to notice,
 * because their own browser showed the corrected figure.
 *
 * Best-effort on purpose: a moderation decision that succeeded must not be
 * reported as failed because the follow-up aggregate write did.
 */
async function refreshProductRating(productSlug: string): Promise<void> {
  if (!productSlug) return;
  try {
    await productRepo.setReviewAggregate(productSlug, await repo.approvedAggregate(productSlug));
  } catch (error) {
    console.error(`[reviews] could not refresh the rating for ${productSlug}`, error);
  }
}

/**
 * The order this reviewer actually had delivered, if there is one.
 *
 * `orderNumber` has been on the review type since the beginning and NOTHING
 * ever wrote it — so "Delivered in <city>", which the reference storefront
 * prints beside every review, had no honest source and was left off the page.
 * This gives it one.
 *
 * Resolved from the SIGNED-IN account, never from `authorEmail` in the body.
 * That field is whatever the browser typed: keyed on it, anyone could type a
 * stranger's address, be told their order was delivered in Mumbai, and have
 * that printed under their own review as a fact about a purchase they never
 * made.
 *
 * Delivered, not merely placed. A review written the hour an order goes in is
 * a review of the ordering, and the line would be saying a delivery happened
 * that has not.
 */
async function deliveredOrderFor(
  productSlug: string,
): Promise<{ orderNumber: string; deliveredCity: string } | null> {
  const account = (await getCustomerAccount()) as { email?: string } | null;
  const email = account?.email?.trim();
  if (!email) return null;

  const orders = await orderRepo.findByCustomerEmail(email);
  // Already newest-first out of the repository; the most recent delivery is
  // the one the reviewer is most likely writing about.
  const delivered = orders.find(
    (order) =>
      order.status === "delivered" &&
      order.items.some((item) => item.productSlug === productSlug),
  );

  const city = delivered?.address?.city?.trim();
  if (!delivered || !city) return null;
  return { orderNumber: delivered.orderNumber, deliveredCity: city };
}

/**
 * The submitted photos, less any this shop did not store itself.
 *
 * The review endpoint is public and unauthenticated, so this list is whatever
 * a browser sent. Rendered as-is it is an arbitrary-image hole on the busiest
 * page the shop has: an off-site URL that loads for every visitor, reports
 * their IP to a stranger, and can be swapped for something else after a
 * moderator has approved it.
 *
 * Checked against the upload ledger rather than by pattern-matching a host.
 * A row there means this shop's own uploader produced that URL, from a file it
 * sniffed, inside the limits that endpoint enforces.
 *
 * Silently dropping the rest is deliberate: the only way to get an unknown URL
 * in here is to have bypassed the uploader, and an error message would just
 * tell whoever did that which check they had hit.
 */
async function storedPhotosAmong(urls: string[] | undefined): Promise<string[] | undefined> {
  const wanted = [...new Set((urls ?? []).map((url) => url.trim()).filter(Boolean))];
  if (wanted.length === 0) return undefined;

  const known = await uploadRepo.findStoredUrls(wanted);
  const kept = wanted.filter((url) => known.has(url));
  return kept.length > 0 ? kept : undefined;
}

// ---- Public (storefront review form) --------------------------------------

export async function submitReview(input: SubmitReviewInput, ctx: RequestCtx): Promise<ProductReview> {
  /**
   * The cake, resolved HERE, from the catalogue this server owns.
   *
   * The browser used to resolve it and send `cakeId`/`cakeName` along — through
   * `loadProducts()`, which on a customer's browser seeds the shipped demo
   * catalogue, so a review of any product the shop had actually created was
   * refused before it left the page.
   *
   * Refusing an unknown slug is the check that lookup was reaching for, and it
   * belongs on this side: the endpoint is public, so a review could otherwise
   * be filed against a slug the shop has never sold, and land in moderation
   * with a blank product name.
   */
  const cake = await productRepo.findBySlug(input.productSlug);
  if (!cake) throw new NotFoundError("Product not found");

  /**
   * Resolved before the row is built, so a review either carries a real
   * delivery or carries nothing. There is no half state where the page shows
   * a city it cannot account for.
   */
  const delivered = await deliveredOrderFor(cake.slug);
  const photoUrls = await storedPhotosAmong(input.photoUrls);

  const now = new Date().toISOString();
  const review: ProductReview = {
    // Minted here, never taken from the body. See `submitReviewSchema`.
    id: `review-${randomUUID()}`,
    cakeId: cake.id,
    productSlug: cake.slug,
    cakeName: cake.name,
    authorName: input.authorName.trim(),
    authorEmail: input.authorEmail?.trim() || undefined,
    rating: Math.min(5, Math.max(1, input.rating)),
    title: input.title?.trim() || undefined,
    body: input.body.trim(),
    // Server-resolved, both of them, and absent for a reviewer who is not
    // signed in or has had nothing delivered.
    orderNumber: delivered?.orderNumber,
    deliveredCity: delivered?.deliveredCity,
    // Only the ones this shop stored itself.
    photoUrls,
    // Forced — a public submission is never pre-approved or featured.
    status: "pending",
    isFeatured: false,
    createdAt: now,
    updatedAt: now,
  };

  await repo.create(review);
  await writeAuditLog({
    action: "review.submit",
    actorEmail: review.authorEmail ?? "",
    target: { type: "review", id: review.id },
    metadata: { productSlug: review.productSlug, rating: review.rating },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return review;
}

/**
 * Count one reader who found an approved review helpful.
 *
 * No audit log entry: this is an anonymous, unauthenticated tap with no actor
 * to record, and writing one per press would bury the log it shares with
 * moderation decisions under noise.
 *
 * Throws NotFound for anything that is not an approved review, so a public id
 * cannot be used to probe for reviews still in moderation.
 */
export async function markReviewHelpful(id: string): Promise<{ helpfulCount: number }> {
  const count = await repo.incrementHelpful(id);
  if (count === null) throw new NotFoundError("Review not found");
  return { helpfulCount: count };
}

// ---- Admin ----------------------------------------------------------------

export async function getReviews(): Promise<ProductReview[]> {
  await ensureSeeded();
  await ensureAggregatesBackfilled();
  return repo.listAll();
}

export function getApprovedForProduct(productSlug: string): Promise<ProductReview[]> {
  return repo.listApprovedByProduct(productSlug);
}

export async function updateReview(
  id: string,
  patch: UpdateReviewInput,
  ctx: RequestCtx,
): Promise<ProductReview> {
  const existing = await repo.findById(id);
  if (!existing) throw new NotFoundError("Review not found");

  const updated = await repo.patch(id, patch);

  // Approving, rejecting or re-rating changes what the product should advertise.
  // The slug can itself be edited, so both the old and the new one are refreshed.
  await refreshProductRating(existing.productSlug);
  if (updated?.productSlug && updated.productSlug !== existing.productSlug) {
    await refreshProductRating(updated.productSlug);
  }

  await writeAuditLog({
    action: "review.update",
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "review", id },
    metadata: { ...patch },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return updated as ProductReview;
}

export async function deleteReviews(ids: string[], ctx: RequestCtx): Promise<number> {
  // Read the slugs BEFORE the rows are gone, or there is nothing left to
  // recompute and the deleted reviews keep counting toward the advertised score.
  const slugs = await repo.slugsForIds(ids);
  const deleted = await repo.deleteMany(ids);
  for (const slug of slugs) await refreshProductRating(slug);

  await writeAuditLog({
    action: "review.delete",
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "review", id: ids.join(",") },
    metadata: { ids, deleted },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return deleted;
}
