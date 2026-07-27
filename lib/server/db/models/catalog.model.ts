import mongoose, { type InferSchemaType, type Model } from "mongoose";

import { applyBaseTransform } from "./_transform";

/**
 * Catalog — a SINGLETON document (one per install), keyed by `key`. Holds the
 * master lists that products reference: categories, flavours, occasions and
 * weight options. Items are stored as Mixed (validated by Zod on write) since
 * they are small value objects, mirroring how settings stores `social`.
 */
const catalogSchema = new mongoose.Schema({
  key: { type: String, default: "singleton", unique: true, index: true },
  categories: { type: [mongoose.Schema.Types.Mixed], default: [] },
  flavours: { type: [mongoose.Schema.Types.Mixed], default: [] },
  occasions: { type: [mongoose.Schema.Types.Mixed], default: [] },
  weights: { type: [mongoose.Schema.Types.Mixed], default: [] },
});

applyBaseTransform(catalogSchema);

export type CatalogDoc = InferSchemaType<typeof catalogSchema>;

export const CatalogModel: Model<CatalogDoc> =
  (mongoose.models.Catalog as Model<CatalogDoc>) ||
  mongoose.model<CatalogDoc>("Catalog", catalogSchema);
