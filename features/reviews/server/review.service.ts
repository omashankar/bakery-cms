import { randomUUID } from "node:crypto";

import { createMongoStore } from "@/lib/server/db/cms-store";
import { writeAuditLog } from "@/lib/server/audit/audit-log";
import { NotFoundError } from "@/lib/server/http/errors";
import * as productRepo from "@/features/products/server/product.repository";
import type { Product } from "@/types/product";
import type { ProductReview } from "@/types/review";

import * as repo from "./review.repository";
import type { SubmitReviewInput, UpdateReviewInput } from "./review.validators";

interface RequestCtx {
  ip: string;
  userAgent: string;
  actorId?: string | null;
  actorEmail?: string;
}

// ---- Demo seed (ported from the client repo; server products source) --------

const SAMPLE_BODIES = [
  "Absolutely delicious! Fresh, moist, and beautifully decorated. Will order again.",
  "Delivered on time and tasted amazing. The whole family loved it.",
  "Great flavour and presentation. Slightly sweeter than expected but still excellent.",
  "Perfect for our celebration. Looked exactly like the photos online.",
  "Soft sponge and rich frosting. One of the best cakes we have ordered.",
];

const SAMPLE_AUTHORS = [
  "Priya Sharma",
  "Rahul Mehta",
  "Ananya Patel",
  "Vikram Singh",
  "Neha Kapoor",
  "Arjun Desai",
];

function seedReviewsFromProducts(cakes: Product[]): ProductReview[] {
  const published = cakes.filter((cake) => cake.status === "published");
  const reviews: ProductReview[] = [];
  let index = 0;

  for (const cake of published.slice(0, 12)) {
    const reviewCount = Math.min(Math.max(cake.reviewCount || 2, 1), 3);

    for (let i = 0; i < reviewCount; i += 1) {
      const timestamp = new Date(Date.now() - (index + 2) * 86400000 * 5).toISOString();
      const rating = i === 0 ? Math.round(cake.rating) : 4 + (index % 2);
      const author = SAMPLE_AUTHORS[index % SAMPLE_AUTHORS.length]!;
      reviews.push({
        id: `review-seed-${cake.slug}-${i}`,
        cakeId: cake.id,
        productSlug: cake.slug,
        cakeName: cake.name,
        authorName: author,
        authorEmail: `${author.split(" ")[0]?.toLowerCase()}@demo.com`,
        rating: Math.min(5, Math.max(1, rating)),
        title: i === 0 ? "Loved it!" : undefined,
        body: SAMPLE_BODIES[index % SAMPLE_BODIES.length]!,
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

const seededFlag = createMongoStore<{ done: boolean }>({
  key: "reviews-seeded",
  seed: () => ({ done: false }),
});

async function ensureSeeded(): Promise<void> {
  const flag = await seededFlag.read();
  if (flag.done) return;
  const products = await productRepo.listAll();
  await repo.seedIfEmpty(seedReviewsFromProducts(products));
  await seededFlag.write({ done: true });
}

// ---- Public (storefront review form) --------------------------------------

export async function submitReview(input: SubmitReviewInput, ctx: RequestCtx): Promise<ProductReview> {
  const now = new Date().toISOString();
  const review: ProductReview = {
    // Minted here, never taken from the body. See `submitReviewSchema`.
    id: `review-${randomUUID()}`,
    cakeId: input.cakeId ?? "",
    productSlug: input.productSlug,
    cakeName: input.cakeName ?? "",
    authorName: input.authorName.trim(),
    authorEmail: input.authorEmail?.trim() || undefined,
    rating: Math.min(5, Math.max(1, input.rating)),
    title: input.title?.trim() || undefined,
    body: input.body.trim(),
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

// ---- Admin ----------------------------------------------------------------

export async function getReviews(): Promise<ProductReview[]> {
  await ensureSeeded();
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
  const deleted = await repo.deleteMany(ids);
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
