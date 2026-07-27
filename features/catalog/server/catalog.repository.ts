import { connectDB } from "@/lib/server/db/mongoose";
import { CatalogModel } from "@/lib/server/db/models/catalog.model";
import { defaultCatalogStore } from "@/features/catalog/lib/catalog-utils";

/**
 * Catalog repository — data access for the singleton catalog document. Seeds
 * from the same `defaultCatalogStore` the client uses, so a fresh install
 * matches the shipped taxonomy.
 */

const SINGLETON = "singleton";

export async function getOrCreateCatalog() {
  await connectDB();
  const existing = await CatalogModel.findOne({ key: SINGLETON });
  if (existing) return existing;

  return CatalogModel.create({
    key: SINGLETON,
    categories: defaultCatalogStore.categories,
    flavours: defaultCatalogStore.flavours,
    occasions: defaultCatalogStore.occasions,
    weights: defaultCatalogStore.weights,
  });
}

export async function updateSection(section: string, value: unknown) {
  const doc = await getOrCreateCatalog();
  doc.set(section, value);
  await doc.save();
  return doc;
}
