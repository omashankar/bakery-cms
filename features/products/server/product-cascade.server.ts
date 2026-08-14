import "server-only";

import { connectDB } from "@/lib/server/db/mongoose";
import { ReviewModel } from "@/lib/server/db/models/review.model";
import { StockHistoryModel } from "@/lib/server/db/models/stock-history.model";

/**
 * Remove the rows that only existed because a product did.
 *
 * Reviews are keyed by `productSlug` and stock history by `cakeId`. Neither was
 * touched when a product was deleted, so both became orphans that still counted:
 * the review aggregate over a slug nobody sells, and a History view listing
 * adjustments to a cake that is gone. Worse, the slug is free again — a NEW cake
 * created with it inherited the deleted product's reviews and star rating.
 *
 * Orders are deliberately NOT touched. A past order is a record of something
 * that happened, and it has to survive the product being withdrawn.
 */
export async function purgeProductTraces(slug: string, id: string): Promise<void> {
  await connectDB();
  await Promise.all([
    ReviewModel.deleteMany({ productSlug: slug }),
    StockHistoryModel.deleteMany({ cakeId: id }),
  ]);
}
