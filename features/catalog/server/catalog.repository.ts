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
    occasions: defaultCatalogStore.occasions,
    // Empty, but SEEDED — so the path exists on a fresh singleton and a first
    // write does not have to create it.
    collections: defaultCatalogStore.collections,
  });
}

export async function updateSection(section: string, value: unknown) {
  const doc = await getOrCreateCatalog();
  doc.set(section, value);
  await doc.save();
  return doc;
}
