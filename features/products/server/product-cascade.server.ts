import "server-only";

import { connectDB } from "@/lib/server/db/mongoose";
import { CatalogModel } from "@/lib/server/db/models/catalog.model";
import { ReviewModel } from "@/lib/server/db/models/review.model";
import { StockHistoryModel } from "@/lib/server/db/models/stock-history.model";
import { collectionsWithProduct } from "@/features/catalog/lib/catalog-utils";
import type { ProductCollection } from "@/types/product";

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
 *
 * Collections are, and were not: a group listing five products showed four
 * after one was deleted, and would go on doing so with no way for the owner to
 * see which id had stopped resolving.
 */
export async function purgeProductTraces(slug: string, id: string): Promise<void> {
  await connectDB();
  await Promise.all([
    ReviewModel.deleteMany({ productSlug: slug }),
    StockHistoryModel.deleteMany({ cakeId: id }),
    forgetProductInCollections(id),
  ]);
}

/**
 * Take a deleted product out of every collection that listed it.
 *
 * A collection holds its members as ids of its own — that is what lets a shop
 * curate an ORDER, which no property of the products could recover — and the
 * price of storing them there is that they outlive what they point at. The
 * storefront tolerates that and filters on read, so a dangling id has never
 * shown a customer anything; what it does is make a collection quietly
 * shorter than it says it is, for ever, with nothing to tell the owner why.
 *
 * Read-modify-write rather than a positional update, because the list lives
 * inside a Mixed array on a singleton document and Mongo cannot $pull through
 * one. Only the collections that actually held the id are rewritten, and the
 * whole thing is skipped when none did — this runs on every product deletion,
 * and most shops have no collections at all.
 */
async function forgetProductInCollections(id: string): Promise<void> {
  const catalog = await CatalogModel.findOne({ key: "singleton" });
  if (!catalog) return;

  const rows = (catalog.collections ?? []) as ProductCollection[];
  /*
    THE SAME FUNCTION THE PRODUCT FORM USES, with nothing wanted — which is
    exactly "take this product out of every collection". Shared rather than
    written twice: the rule about leaving untouched rows alone, and about
    appending rather than inserting, is one rule and it has one test.
  */
  const { next, changed } = collectionsWithProduct(rows, id, []);
  if (changed === 0) return;

  catalog.collections = next;
  /*
    Mixed arrays are not tracked by Mongoose, so a replaced element is saved
    only if the path is marked by hand — the failure this repo has hit four
    times, in the shape where the API answers 200 and the write is dropped.
  */
  catalog.markModified("collections");
  await catalog.save();
}
