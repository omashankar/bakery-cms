import type { Metadata } from "next";
import { CollectionsPage } from "@/apps/website/pages/collections-page";
import { getStorefrontProductCards } from "@/features/products/data/products-service";
import {
  getStorefrontCategories,
  getStorefrontCollections,
  getStorefrontDepartments,
  getStorefrontOccasions,
} from "@/apps/website/lib/storefront-categories.server";
import { departmentFor, offeredAxes } from "@/features/catalog/lib/catalog-utils";
import { getServerLabels } from "@/features/settings/server/labels.server";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const [{ slug }, categories, collections, occasions, labels] = await Promise.all([
    params,
    getStorefrontCategories(),
    getStorefrontCollections(),
    getStorefrontOccasions(),
    getServerLabels(),
  ]);
  /**
   * COLLECTIONS FIRST, then categories — the same order the page itself
   * resolves in, or the title and the grid would describe different things.
   *
   * The two share one address space: a slug resolves against categories OR
   * occasions OR collections, and nothing stopped them colliding until the
   * admin's slug check started reading all three lists. A collection wins
   * because it is the one a person deliberately created at that address.
   */
  const collection = collections.find((item) => item.slug === slug);
  // The SHOP's categories, not the shipped demo list — a category the shop
  // added used to get the generic "Collection" in its <title> and a renamed one
  // kept the old name there long after the page itself had changed.
  const category = categories.find((item) => item.slug === slug);
  /*
    And an OCCASION last, for a slug neither of the other two claims.

    Occasions have their own address now, so this is the backward-compatible
    tail of the old one: a shop that published /store/collections/diwali when
    Diwali was only ever an occasion still has that link answer, and answer
    with the occasion's name rather than the generic one.
  */
  const occasion = occasions.find((item) => item.slug === slug);
  const named = collection ?? category ?? occasion;

  return {
    title: named ? named.name : "Collection",
    // “our bakery store” and “cake collections”, on the page whose whole job is
    // to be the shop’s own catalogue. The shop’s subtitle is a configured field.
    description:
      // The owner's own pitch when they wrote one — it is the sentence that
      // gets shared, and a generated "Shop diwali gifts at …" replaces it with
      // something nobody chose.
      collection?.description?.trim() ||
      (named
        ? `Shop ${named.name.toLowerCase()} at ${labels.collectionsTitle.toLowerCase()}.`
        : labels.collectionsSubtitle),
  };
}

export default async function Page({ params }: PageProps) {
  const [{ slug }, catalog, categories, collections, occasions, departments] = await Promise.all([
    params,
    getStorefrontProductCards(),
    getStorefrontCategories(),
    getStorefrontCollections(),
    getStorefrontOccasions(),
    /*
      FREE. `getCatalog` is `cache()`d and the three reads above have already
      taken it, so this is a fourth caller of one memoised document rather than
      a fourth round trip.
    */
    getStorefrontDepartments(),
  ]);

  // Resolved here rather than in the page, so the client component receives a
  // decision rather than three lists and the rule for choosing between them.
  const collection = collections.find((item) => item.slug === slug);
  /*
    An occasion answers only for a slug NO category claims.

    The category wins because this is the category's address — it is where
    every pill, every menu row and every card links — and because the listing
    behind it no longer folds occasion tags in, so a category page here is the
    category and nothing else. An occasion that shares the slug has its own
    page at /store/occasions/<slug>; one that does not share it would
    otherwise have lost the address it was reachable at before today.
  */
  const category = categories.find((item) => item.slug === slug);
  const occasion =
    collection || category ? undefined : occasions.find((item) => item.slug === slug);

  /*
    THE DEPARTMENT THIS CATEGORY SITS UNDER — the same question the trail above
    a product asks, through the same `departmentFor`, so the two screens cannot
    name different ones for the same category.

    ONLY WHEN THE CATEGORY IS WHAT THIS PAGE IS. A collection wins the address
    above, and a collection is not filed under a department; an occasion only
    answers for a slug no category claims. So the crumb is resolved for the
    category case and the page checks the same thing again before drawing it.

    NO HREF, exactly as on the product page: a department has no page of its
    own, and a crumb is a promise that one exists.
  */
  const departmentOfCategory =
    !collection && category
      ? departmentFor(offeredAxes({ categories, occasions, collections, departments }).departments, category.id)
      : undefined;

  return (
    <CollectionsPage
      categorySlug={slug}
      departmentCrumb={departmentOfCategory ? { label: departmentOfCategory.name } : undefined}
      catalog={catalog}
      categories={categories}
      collection={
        collection
          ? {
              name: collection.name,
              description: collection.description,
              productIds: collection.productIds,
            }
          : undefined
      }
      occasion={occasion ? { name: occasion.name, slug: occasion.slug } : undefined}
    />
  );
}
