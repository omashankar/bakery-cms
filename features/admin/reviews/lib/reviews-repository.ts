import { loadCakes, updateCake } from "@/features/admin/cakes/lib/cakes-repository";
import type { Cake } from "@/types/cake";
import type {
  ProductReview,
  ProductReviewFormData,
  ProductReviewStatus,
} from "@/types/review";

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

function seedReviews(cakes: Cake[]): ProductReview[] {
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
        cakeSlug: cake.slug,
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
    return seedReviews(loadCakes());
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

export function syncCakeReviewAggregates(): void {
  const reviews = readReviews();
  const approvedByCake = new Map<string, ProductReview[]>();

  for (const review of reviews) {
    if (review.status !== "approved") continue;
    const list = approvedByCake.get(review.cakeSlug) ?? [];
    list.push(review);
    approvedByCake.set(review.cakeSlug, list);
  }

  for (const cake of loadCakes()) {
    const approved = approvedByCake.get(cake.slug) ?? [];
    if (approved.length === 0) continue;

    const reviewCount = approved.length;
    const rating =
      Math.round((approved.reduce((sum, item) => sum + item.rating, 0) / reviewCount) * 10) /
      10;

    if (cake.reviewCount === reviewCount && cake.rating === rating) continue;

    const { id, createdAt, updatedAt, ...form } = cake;
    updateCake(id, {
      ...form,
      reviewCount,
      rating,
    });
  }
}

export function loadReviews(): ProductReview[] {
  if (typeof window === "undefined") return seedReviews(loadCakes());

  const storedVersion = Number(localStorage.getItem(STORAGE_VERSION_KEY) ?? 0);
  const existing = readReviews();

  if (existing.length === 0 || storedVersion < REVIEWS_STORAGE_VERSION) {
    const seeded = existing.length > 0 ? existing : seedReviews(loadCakes());
    writeReviews(seeded);
    localStorage.setItem(STORAGE_VERSION_KEY, String(REVIEWS_STORAGE_VERSION));
    syncCakeReviewAggregates();
    return seeded;
  }

  return existing.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getReviewById(id: string): ProductReview | null {
  return loadReviews().find((review) => review.id === id) ?? null;
}

export function getApprovedReviewsForCake(cakeSlug: string): ProductReview[] {
  return loadReviews()
    .filter((review) => review.cakeSlug === cakeSlug && review.status === "approved")
    .sort((a, b) => {
      if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

export function getStorefrontReviewsForCake(cakeSlug: string) {
  return getApprovedReviewsForCake(cakeSlug).map((review) => ({
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

export function createReview(data: ProductReviewFormData): ProductReview {
  const reviews = loadReviews();
  const timestamp = nowIso();
  const review: ProductReview = {
    ...data,
    id: `review-${Date.now()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  writeReviews([review, ...reviews]);
  syncCakeReviewAggregates();
  return review;
}

export function updateReview(id: string, data: ProductReviewFormData): ProductReview | null {
  const reviews = loadReviews();
  const index = reviews.findIndex((review) => review.id === id);
  if (index === -1) return null;

  const updated: ProductReview = {
    ...reviews[index],
    ...data,
    id,
    updatedAt: nowIso(),
  };
  reviews[index] = updated;
  writeReviews(reviews);
  syncCakeReviewAggregates();
  return updated;
}

export function setReviewStatus(id: string, status: ProductReviewStatus): ProductReview | null {
  const review = getReviewById(id);
  if (!review) return null;
  return updateReview(id, {
    ...review,
    status,
    reportReason: status === "reported" ? review.reportReason : undefined,
  });
}

export function approveReviews(ids: string[]): number {
  let count = 0;
  const reviews = loadReviews().map((review) => {
    if (!ids.includes(review.id)) return review;
    count += 1;
    return { ...review, status: "approved" as const, updatedAt: nowIso() };
  });
  writeReviews(reviews);
  syncCakeReviewAggregates();
  return count;
}

export function rejectReviews(ids: string[]): number {
  let count = 0;
  const reviews = loadReviews().map((review) => {
    if (!ids.includes(review.id)) return review;
    count += 1;
    return { ...review, status: "rejected" as const, updatedAt: nowIso() };
  });
  writeReviews(reviews);
  syncCakeReviewAggregates();
  return count;
}

export function toggleReviewFeatured(id: string): ProductReview | null {
  const review = getReviewById(id);
  if (!review) return null;
  return updateReview(id, { ...review, isFeatured: !review.isFeatured });
}

export function saveReviewReply(id: string, adminReply: string): ProductReview | null {
  const review = getReviewById(id);
  if (!review) return null;
  return updateReview(id, {
    ...review,
    adminReply: adminReply.trim(),
    repliedAt: nowIso(),
  });
}

export function reportReview(id: string, reportReason: string): ProductReview | null {
  const review = getReviewById(id);
  if (!review) return null;
  return updateReview(id, {
    ...review,
    status: "reported",
    reportReason: reportReason.trim() || "Flagged by moderator",
  });
}

export function deleteReviews(ids: string[]): number {
  const reviews = loadReviews();
  const next = reviews.filter((review) => !ids.includes(review.id));
  const count = reviews.length - next.length;
  writeReviews(next);
  syncCakeReviewAggregates();
  return count;
}

export function submitStorefrontReview(input: {
  cakeSlug: string;
  authorName: string;
  authorEmail?: string;
  rating: number;
  title?: string;
  body: string;
}): ProductReview | null {
  const cake = loadCakes().find((item) => item.slug === input.cakeSlug);
  if (!cake) return null;

  return createReview({
    cakeId: cake.id,
    cakeSlug: cake.slug,
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

export function resetReviews(): ProductReview[] {
  const seeded = seedReviews(loadCakes());
  writeReviews(seeded);
  localStorage.setItem(STORAGE_VERSION_KEY, String(REVIEWS_STORAGE_VERSION));
  syncCakeReviewAggregates();
  return seeded;
}
