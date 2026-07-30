import { loadProducts, updateProduct } from "@/features/products/lib/products-repository";
import type { Product } from "@/types/product";
import type {
  ProductReview,
  ProductReviewFormData,
  ProductReviewStatus,
} from "@/types/review";
import {
  submitReviewRequest,
  updateReviewRequest,
  deleteReviewsRequest,
} from "./reviews-api";

const STORAGE_KEY = "bakery-cms-product-reviews";
const STORAGE_VERSION_KEY = "bakery-cms-product-reviews-version";
const REVIEWS_STORAGE_VERSION = 1;

export const REVIEWS_UPDATED_EVENT = "bakery-reviews-updated";

const sampleBodies = [
  "Absolutely delicious! Fresh, moist, and beautifully decorated. Will order again.",
  "Delivered on time and tasted amazing. The whole family loved it.",
  "Great flavour and presentation. Slightly sweeter than expected but still excellent.",
  "Perfect for our celebration. Looked exactly like the photos online.",
  "Soft sponge and rich frosting. One of the best cakes we have ordered.",
];

const sampleAuthors = [
  "Priya Sharma",
  "Rahul Mehta",
  "Ananya Patel",
  "Vikram Singh",
  "Neha Kapoor",
  "Arjun Desai",
];

function nowIso(): string {
  return new Date().toISOString();
}

function emitReviewsUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(REVIEWS_UPDATED_EVENT));
}

function seedReviews(cakes: Product[]): ProductReview[] {
  const published = cakes.filter((cake) => cake.status === "published");
  const reviews: ProductReview[] = [];
  let index = 0;

  for (const cake of published.slice(0, 12)) {
    const reviewCount = Math.min(Math.max(cake.reviewCount || 2, 1), 3);

    for (let i = 0; i < reviewCount; i += 1) {
      const timestamp = new Date(Date.now() - (index + 2) * 86400000 * 5).toISOString();
      const rating = i === 0 ? Math.round(cake.rating) : 4 + (index % 2);
      reviews.push({
        id: `review-seed-${cake.slug}-${i}`,
        cakeId: cake.id,
        productSlug: cake.slug,
        cakeName: cake.name,
        authorName: sampleAuthors[index % sampleAuthors.length],
        authorEmail: `${sampleAuthors[index % sampleAuthors.length].split(" ")[0]?.toLowerCase()}@demo.com`,
        rating: Math.min(5, Math.max(1, rating)),
        title: i === 0 ? "Loved it!" : undefined,
        body: sampleBodies[index % sampleBodies.length],
        status: index % 7 === 0 ? "pending" : index % 11 === 0 ? "reported" : "approved",
        isFeatured: index % 9 === 0,
        reportReason: index % 11 === 0 ? "Customer flagged inappropriate language (demo)" : undefined,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      index += 1;
    }
  }

  return reviews;
}

function readReviews(): ProductReview[] {
  if (typeof window === "undefined") {
    return seedReviews(loadProducts());
  }

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

export function syncProductReviewAggregates(): void {
  const reviews = readReviews();
  const approvedByProduct = new Map<string, ProductReview[]>();

  for (const review of reviews) {
    if (review.status !== "approved") continue;
    const list = approvedByProduct.get(review.productSlug) ?? [];
    list.push(review);
    approvedByProduct.set(review.productSlug, list);
  }

  for (const cake of loadProducts()) {
    const approved = approvedByProduct.get(cake.slug) ?? [];
    if (approved.length === 0) continue;

    const reviewCount = approved.length;
    const rating =
      Math.round((approved.reduce((sum, item) => sum + item.rating, 0) / reviewCount) * 10) /
      10;

    if (cake.reviewCount === reviewCount && cake.rating === rating) continue;

    const { id, createdAt, updatedAt, ...form } = cake;
    updateProduct(id, {
      ...form,
      reviewCount,
      rating,
    });
  }
}

export function loadReviews(): ProductReview[] {
  if (typeof window === "undefined") return seedReviews(loadProducts());

  const storedVersion = Number(localStorage.getItem(STORAGE_VERSION_KEY) ?? 0);
  const existing = readReviews();

  if (existing.length === 0 || storedVersion < REVIEWS_STORAGE_VERSION) {
    const seeded = existing.length > 0 ? existing : seedReviews(loadProducts());
    writeReviews(seeded);
    localStorage.setItem(STORAGE_VERSION_KEY, String(REVIEWS_STORAGE_VERSION));
    syncProductReviewAggregates();
    return seeded;
  }

  return existing.sort(
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
}

export async function createReview(data: ProductReviewFormData): Promise<ReviewWriteResult> {
  const reviews = loadReviews();
  const timestamp = nowIso();
  const review: ProductReview = {
    ...data,
    id: `review-${Date.now()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  writeReviews([review, ...reviews]);
  syncProductReviewAggregates();
  return { review, persisted: await submitReviewRequest(review) };
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
  syncProductReviewAggregates();
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
    reportReason: status === "reported" ? review.reportReason : undefined,
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
  const reviews = loadReviews().map((review) =>
    ids.includes(review.id) ? { ...review, status, updatedAt: nowIso() } : review
  );
  writeReviews(reviews);
  syncProductReviewAggregates();

  // Every id is sent and every answer counted. `forEach` over an async call
  // discarded all of them, so a batch in which the server refused every single
  // write was indistinguishable from one it accepted whole.
  const results = await Promise.all(ids.map((id) => updateReviewRequest(id, { status })));
  const failed = results.filter((ok) => !ok).length;

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
  syncProductReviewAggregates();
  return { count, persisted: await deleteReviewsRequest(ids) };
}

export function submitStorefrontReview(input: {
  productSlug: string;
  authorName: string;
  authorEmail?: string;
  rating: number;
  title?: string;
  body: string;
}): Promise<ReviewWriteResult> {
  const cake = loadProducts().find((item) => item.slug === input.productSlug);
  if (!cake) return Promise.resolve({ review: null, persisted: false });

  return createReview({
    cakeId: cake.id,
    productSlug: cake.slug,
    cakeName: cake.name,
    authorName: input.authorName.trim(),
    authorEmail: input.authorEmail?.trim() || undefined,
    rating: Math.min(5, Math.max(1, input.rating)),
    title: input.title?.trim() || undefined,
    body: input.body.trim(),
    status: "pending",
    isFeatured: false,
  });
}

export async function resetReviews(): Promise<ProductReview[]> {
  const previous = readReviews();
  const seeded = seedReviews(loadProducts());
  writeReviews(seeded);
  localStorage.setItem(STORAGE_VERSION_KEY, String(REVIEWS_STORAGE_VERSION));
  syncProductReviewAggregates();

  // Persist the reset to the server via the SAME dual-write requests the CRUD
  // uses, so the reset survives an admin reload (otherwise the server-sync
  // hydration re-applies the old moderated state and the reset appears to
  // revert). Reviews have no bulk replace endpoint, so mirror the per-item CRUD:
  // delete rows that are no longer seeds, then PATCH every seed back to its
  // demo state (status/featured/reply/report), which the server already holds.
  const seededIds = new Set(seeded.map((review) => review.id));
  const staleIds = previous
    .map((review) => review.id)
    .filter((id) => !seededIds.has(id));
  if (staleIds.length > 0) await deleteReviewsRequest(staleIds);

  await Promise.all(
    seeded.map((review) =>
      updateReviewRequest(review.id, {
        status: review.status,
        isFeatured: review.isFeatured,
        title: review.title ?? "",
        body: review.body,
        rating: review.rating,
        adminReply: review.adminReply ?? "",
        repliedAt: review.repliedAt ?? "",
        reportReason: review.reportReason ?? "",
      })
    )
  );

  return seeded;
}
