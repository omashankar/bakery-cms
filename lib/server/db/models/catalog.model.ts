import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { applyBaseTransform } from "./_transform";

/**
 * Catalog — a SINGLETON document (one per install), keyed by `key`. Holds the
 * three master lists a product is filed against: categories, occasions and
 * collections. Items are stored as Mixed (validated by Zod on write) since they
 * are small value objects, mirroring how settings stores `social`.
 *
 * `flavours` and `weights` were declared here too. Both had already been taken
 * out of the code — a flavour became a word typed on the product, and sizes
 * moved onto the product because a shop-wide list is the wrong shape for a shop
 * that sells more than one kind of thing — and neither has been read since. The
 * declarations were what kept the rows alive in the database, where they sat
 * for months answering nothing. `scripts/the-catalog-drops-what-nothing-reads.mjs`
 * removed them; this is what stops `default: []` putting them back on the next
 * write.
 */
const catalogSchema = new mongoose.Schema({
  key: { type: String, default: "singleton", unique: true, index: true },
  categories: { type: [mongoose.Schema.Types.Mixed], default: [] },
  occasions: { type: [mongoose.Schema.Types.Mixed], default: [] },
  /**
   * Declared, or every collection a shop creates is dropped on write while
   * the API answers 200 and the admin re-renders its own state as though it
   * had saved. This schema is built with no options, so Mongoose `strict` is
   * on — the failure this repo has hit four times.
   */
  collections: { type: [mongoose.Schema.Types.Mixed], default: [] },
  departments: { type: [mongoose.Schema.Types.Mixed], default: [] },
});

applyBaseTransform(catalogSchema);

export type CatalogDoc = InferSchemaType<typeof catalogSchema>;

export const CatalogModel: Model<CatalogDoc> =
  (mongoose.models.Catalog as Model<CatalogDoc>) ||
  mongoose.model<CatalogDoc>("Catalog", catalogSchema);
