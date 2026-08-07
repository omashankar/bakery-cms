import mongoose, { type Model } from "mongoose";

import type { Product } from "@/types/product";

/**
 * Product document.
 *
 * `_id` is the app's own string id (e.g. "product-…", "cake-…") — NOT an
 * ObjectId — so every existing reference (orders, reviews, inventory, cart)
 * keeps working after the move off JSON/localStorage. Rich nested shapes
 * (weights, variantGroups, seo) are stored as Mixed; the Zod layer validates
 * them on write. `createdAt`/`updatedAt` stay ISO strings to match the Product
 * type, so the app manages them (not Mongoose timestamps).
 */
const productSchema = new mongoose.Schema(
  {
    _id: { type: String },
    name: { type: String, required: true },
    // Unique in the DATABASE, not just checked in JS. The route scanned for a
    // clashing slug and then wrote, which two requests can both pass — and the
    // slug is the storefront's product URL, so a collision means one of the two
    // cakes is unreachable and the other answers for it.
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: "" },
    shortDescription: { type: String },
    price: { type: Number, default: 0 },
    compareAtPrice: { type: Number },
    images: { type: [String], default: [] },
    categoryId: { type: String, default: "" },
    flavourId: { type: String },
    occasionIds: { type: [String], default: [] },
    weights: { type: [mongoose.Schema.Types.Mixed], default: [] },
    status: { type: String, default: "draft" },
    isFeatured: { type: Boolean, default: false },
    isBestSeller: { type: Boolean, default: false },
    isTrending: { type: Boolean, default: false },
    isEggless: { type: Boolean, default: false },
    isPhotoCake: { type: Boolean, default: false },
    isSeasonal: { type: Boolean, default: false },
    shapes: { type: [String], default: [] },
    flavourOptions: { type: [String], default: [] },
    stockStatus: { type: String, default: "in_stock" },
    stockQuantity: { type: Number, default: 0 },
    unlimitedStock: { type: Boolean, default: false },
    lowStockThreshold: { type: Number },
    allowsMessage: { type: Boolean, default: true },
    allowsPhotoUpload: { type: Boolean, default: false },
    ingredients: { type: String },
    variantGroups: { type: [mongoose.Schema.Types.Mixed], default: [] },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    seo: { type: mongoose.Schema.Types.Mixed, default: {} },
    // ProductDetails
    barcode: { type: String },
    preparationTimeMinutes: { type: Number },
    shelfLifeDays: { type: Number },
    calories: { type: Number },
    allergens: { type: String },
    careInstructions: { type: String },
    // App-managed ISO timestamps (not Mongoose `timestamps`).
    createdAt: { type: String },
    updatedAt: { type: String },
  },
  { minimize: false },
);

productSchema.set("toJSON", {
  virtuals: false,
  versionKey: false,
  transform(_doc, ret: Record<string, unknown>) {
    ret.id = ret._id;
    delete ret._id;
    return ret;
  },
});

/**
 * Stored shape: the app's `id` becomes Mongo's string `_id`; every other Product
 * field is stored as-is. Typing the model with this (not Product) avoids the
 * `id`/`_id` clash and keeps repository writes type-safe.
 */
export type ProductDoc = { _id: string } & Omit<Product, "id">;

export const ProductModel: Model<ProductDoc> =
  (mongoose.models.Product as Model<ProductDoc>) ||
  mongoose.model<ProductDoc>("Product", productSchema);
