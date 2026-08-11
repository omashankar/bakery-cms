import { loadProducts } from "@/features/products/lib/products-repository";
import type {
  ProductReview,
  ProductReviewFormData,
  ProductReviewStatus,
} from "@/types/review";
import {
  fetchReviews,
  submitReviewRequest,
  updateReviewRequest,
  deleteReviewsRequest,
} from "./reviews-api";

const STORAGE_KEY = "bakery-cms-product-reviews";

export const REVIEWS_UPDATED_EVENT = "bakery-reviews-updated";


function nowIso(): string {
  return new Date().toISOString();
}

/** Unique within this browser, which `Date.now()` alone is not. */
function newLocalId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function emitReviewsUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(REVIEWS_UPDATED_EVENT));
}

function readReviews(): ProductReview[] {
  // No storage on the server, and nothing to invent — the reviews collection is
  // the only source. Callers here are all admin-side and hydrate from it.
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as ProductReview[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeReviews(reviews: ProductReview[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
  emitReviewsUpdated();
}

/** Hydration: replace the local cache with the server's reviews (no re-push). */
export function persistServerReviews(reviews: ProductReview[]): void {
  writeReviews(reviews);
}

// The product rating is computed on the SERVER now, over every approved review,
// and written to the product document — see `refreshProductRating` in
// features/reviews/server/review.service.ts.
//
// `syncProductReviewAggregates` used to live here. It computed the right average
// and then handed it to `updateProduct`, which only writes localStorage — so the
// moderator's own screen showed the corrected score while every customer kept
// seeing the seeded one, and nothing surfaced the difference. It also skipped
// products with zero approved reviews, so rejecting the last review left the old
// score advertised forever.

/**
 * The admin's cached review list. A CACHE — never a source of reviews.
 *
 * This used to invent reviews whenever the cache was empty, from the product's
 * own rating and a table of sample names. Two things followed: empty meant "not
 * seeded yet", so a moderator who deleted every review saw the fabrication
 * reappear and be pushed back to the server; and the storefront read the same
 * function, so a first-time visitor — whose storage is empty by definition — was
 * shown reviews signed with invented customer names.
 *
 * The server seeds a demo shop once, which is the right place for it. Empty here
 * now means empty, and the list fills when `useReviewsServerSync` hydrates it.
 */
export function loadReviews(): ProductReview[] {
  if (typeof window === "undefined") return [];

  return readReviews().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getReviewById(id: string): ProductReview | null {
  return loadReviews().find((review) => review.id === id) ?? null;
}

export function getApprovedReviewsForProduct(productSlug: string): ProductReview[] {
  return loadReviews()
    .filter((review) => review.productSlug === productSlug && review.status === "approved")
    .sort((a, b) => {
      if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

export function getStorefrontReviewsForProduct(productSlug: string) {
  return getApprovedReviewsForProduct(productSlug).map((review) => ({
    id: review.id,
    author: review.authorName,
    rating: review.rating,
    text: review.body,
    title: review.title,
    date: review.createdAt,
    adminReply: review.adminReply,
    repliedAt: review.repliedAt,
    isFeatured: review.isFeatured,
  }));
}

/**
 * A review write, plus whether the SERVER took it.
 *
 * The local list is a cache the next hydration overwrites. So an approval the
 * server rejected un-approves itself on reload — and in the meantime the
 * moderator has moved on believing the review is live (or taken down).
 */
export interface ReviewWriteResult {
  review: ProductReview | null;
  persisted: boolean;
  /**
   * Stored, but one follow-up step did not land.
   *
   * The admin "Add review" form is two writes: the public submit, then an
   * admin PATCH for status and feature. When only the second failed this used
   * to report `persisted: false` — "nothing was saved" — and the obvious
   * response is to submit again, which creates a duplicate review.
   */
  partial?: "moderation";
}

export async function createReview(data: ProductReviewFormData): Promise<ReviewWriteResult> {
  const reviews = loadReviews();
  const timestamp = nowIso();
  const review: ProductReview = {
    ...data,
    // `review-${Date.now()}` gave two reviews added in the same millisecond the
    // SAME id, so the second overwrote the first in the cache and a bulk action
    // over both addressed one row. The server mints the real id; this only has
    // to be unique until the response lands.
    id: `review-${newLocalId()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  writeReviews([review, ...reviews]);

  const stored = await submitReviewRequest(review);
  if (!stored) return { review, persisted: false };

  // The server mints the id, so the local row has to adopt it. Without this the
  // moderation PATCH below addresses an id the server has never heard of, and
  // every later edit or delete of this review from the admin list misses too —
  // the row would look editable and quietly change nothing.
  if (stored.id !== review.id) {
    review.id = stored.id;
    writeReviews([review, ...reviews]);
  }

  // POST /api/reviews is the PUBLIC submit route, so the server forces every new
  // review to pending and unfeatured — correctly, since a stranger must not be
  // able to publish their own review. But the admin's "Add review" form offers
  // Status and "Feature on the product page", and those choices were silently
  // dropped: the row rendered approved from the local cache while the server
  // held it pending, so it never appeared on the product page and flipped back
  // on the next load. Apply them through the ADMIN route, which is allowed to.
  const moderation: Partial<ProductReviewFormData> = {};
  if (data.status !== "pending") moderation.status = data.status;
  if (data.isFeatured) moderation.isFeatured = true;
  if (Object.keys(moderation).length === 0) return { review, persisted: true };

  const moderated = await updateReviewRequest(review.id, moderation);
  if (moderated) return { review, persisted: true };

  // The review IS stored — only the status/feature step failed. Reporting
  // `persisted: false` said "nothing was saved", and the obvious response to
  // that is to submit the form again, which creates a second review. The row is
  // pending; say so, and let the admin approve it from the list.
  return { review, persisted: true, partial: "moderation" };
}

export async function updateReview(
  id: string,
  data: ProductReviewFormData
): Promise<ReviewWriteResult> {
  const reviews = loadReviews();
  const index = reviews.findIndex((review) => review.id === id);
  if (index === -1) return { review: null, persisted: false };

  const updated: ProductReview = {
    ...reviews[index],
    ...data,
    id,
    updatedAt: nowIso(),
  };
  reviews[index] = updated;
  writeReviews(reviews);
  return { review: updated, persisted: await updateReviewRequest(id, data) };
}

export function setReviewStatus(
  id: string,
  status: ProductReviewStatus
): Promise<ReviewWriteResult> {
  const review = getReviewById(id);
  if (!review) return Promise.resolve({ review: null, persisted: false });
  return updateReview(id, {
    ...review,
    status,
    // "" clears it, `undefined` does not: `JSON.stringify` drops undefined keys,
    // so the PATCH body never carried the field and the server's `$set` never
    // touched it. Approving a reported review cleared the flag on this screen
    // and left it in the database, where the next hydration brought it back.
    reportReason: status === "reported" ? review.reportReason : "",
  });
}

export interface BulkReviewResult {
  /** How many the server accepted. */
  updated: number;
  /** How many it refused — these are still in their old state on the server. */
  failed: number;
}

async function setStatusBulk(
  ids: string[],
  status: "approved" | "rejected"
): Promise<BulkReviewResult> {
  // Every id is sent and every answer counted. `forEach` over an async call
  // discarded all of them, so a batch in which the server refused every single
  // write was indistinguishable from one it accepted whole.
  const results = await Promise.all(ids.map((id) => updateReviewRequest(id, { status })));

  // Only the ones it took. The whole selection used to be written to the cache
  // optimistically and never rolled back, so rows the server refused rendered in
  // their new state — moderated, in the moderator's view, and untouched in the
  // shop — until a reload silently put them back.
  //
  // Counted from the answers rather than from the set, so a duplicate id in the
  // selection cannot make the report disagree with the number of writes made.
  const failed = results.filter((ok) => !ok).length;
  const accepted = new Set(ids.filter((_, index) => results[index]));

  if (accepted.size > 0) {
    writeReviews(
      loadReviews().map((review) =>
        accepted.has(review.id) ? { ...review, status, updatedAt: nowIso() } : review
      )
    );
  }

  return { updated: ids.length - failed, failed };
}

export function approveReviews(ids: string[]): Promise<BulkReviewResult> {
  return setStatusBulk(ids, "approved");
}

export function rejectReviews(ids: string[]): Promise<BulkReviewResult> {
  return setStatusBulk(ids, "rejected");
}

export function toggleReviewFeatured(id: string): Promise<ReviewWriteResult> {
  const review = getReviewById(id);
  if (!review) return Promise.resolve({ review: null, persisted: false });
  return updateReview(id, { ...review, isFeatured: !review.isFeatured });
}

export function saveReviewReply(id: string, adminReply: string): Promise<ReviewWriteResult> {
  const review = getReviewById(id);
  if (!review) return Promise.resolve({ review: null, persisted: false });
  return updateReview(id, {
    ...review,
    adminReply: adminReply.trim(),
    repliedAt: nowIso(),
  });
}

export function reportReview(id: string, reportReason: string): Promise<ReviewWriteResult> {
  const review = getReviewById(id);
  if (!review) return Promise.resolve({ review: null, persisted: false });
  return updateReview(id, {
    ...review,
    status: "reported",
    reportReason: reportReason.trim() || "Flagged by moderator",
  });
}

export async function deleteReviews(
  ids: string[]
): Promise<{ count: number; persisted: boolean }> {
  const reviews = loadReviews();
  const next = reviews.filter((review) => !ids.includes(review.id));
  const count = reviews.length - next.length;
  writeReviews(next);
  return { count, persisted: await deleteReviewsRequest(ids) };
}

/**
 * A customer's review, submitted from the storefront.
 *
 * This used to resolve the product through `loadProducts()` and refuse
 * outright when it could not find it. `loadProducts()` reads the ADMIN's
 * localStorage cache and seeds the shipped DEMO catalogue when that key is
 * missing — and it is always missing in a customer's browser, because
 * `useProductCacheSync` runs only in the admin layout. So the lookup ran
 * against the demo cakes, and any product the shop had actually created was
 * "not found": every review of it was refused with "Could not submit review",
 * every time, for every customer, with no retry that could ever work.
 *
 * The slug is enough. The server owns the catalogue, resolves the cake from
 * the slug, and refuses one it does not have — which is the check this was
 * trying to be.
 */
export function submitStorefrontReview(input: {
  productSlug: string;
  cakeName?: string;
  authorName: string;
  authorEmail?: string;
  rating: number;
  title?: string;
  body: string;
}): Promise<ReviewWriteResult> {
  return createReview({
    productSlug: input.productSlug,
    // For the local row only, so the optimistic copy reads properly before the
    // server's answer lands. The server fills in the authoritative values.
    cakeId: "",
    cakeName: input.cakeName ?? "",
    authorName: input.authorName.trim(),
    authorEmail: input.authorEmail?.trim() || undefined,
    rating: Math.min(5, Math.max(1, input.rating)),
    title: input.title?.trim() || undefined,
    body: input.body.trim(),
    status: "pending",
    isFeatured: false,
  });
}

/**
 * Throw away this browser's cached list and take the server's.
 *
 * This was `resetReviews`, and it did something else entirely: it rebuilt a
 * fabricated demo list from the products, then DELETED from the server every
 * review that was not part of that fabrication. One unconfirmed click on a
 * button labelled "Reset demo" permanently destroyed every genuine customer
 * review the shop had ever received, and then reported success.
 *
 * A reset on a cached screen should mean "discard what this browser thinks and
 * ask again", which is what this does. Nothing is deleted. The demo seed is the
 * server's business and happens once per shop.
 */
export async function reloadReviewsFromServer(): Promise<{
  reviews: ProductReview[];
  persisted: boolean;
}> {
  const fromServer = await fetchReviews();
  if (!fromServer) return { reviews: loadReviews(), persisted: false };

  writeReviews(fromServer);
  return { reviews: fromServer, persisted: true };
}
