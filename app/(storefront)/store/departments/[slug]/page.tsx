import type { Metadata } from "next";

import { CollectionsPage } from "@/apps/website/pages/collections-page";
import { getStorefrontProductCards } from "@/features/products/data/products-service";
import {
  getStorefrontCategories,
  getStorefrontCollections,
  getStorefrontDepartments,
  getStorefrontOccasions,
} from "@/apps/website/lib/storefront-categories.server";
import { offeredAxes } from "@/features/catalog/lib/catalog-utils";
import { getServerLabels } from "@/features/settings/server/labels.server";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * A DEPARTMENT'S OWN PAGE.
 *
 * A department is the kind of thing a shop sells — Cakes, Flowers, Gifts — and
 * it had no address. The header drew it as a heading and the trail above a
 * product as a plain word, both carrying a comment saying a crumb is a promise
 * that a page exists and this one did not. So the one axis that answers "what
 * sort of shop is this" was the only one a customer could not open.
 *
 * TWO STEPS FROM A PRODUCT, which is what makes it different from the other
 * three doors at this layout. A collection is a list of products, an occasion
 * is a tag on a product, a category is filed on a product — a department holds
 * CATEGORIES, and a product is in it because it is in one of those. The grid
 * is `productsInDepartment` over the department's `categoryIds`.
 *
 * A SIBLING, NOT A PARENT. A category keeps `/store/collections/<slug>`, which
 * is where every pill, menu row and card links. Nesting it under the
 * department would move addresses the day a shop re-files a category, and
 * three of this shop's 29 products are in two categories at once — the same
 * reasoning that keeps the product address flat.
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const [{ slug }, departments, labels] = await Promise.all([
    params,
    getStorefrontDepartments(),
    getServerLabels(),
  ]);

  const department = departments.find((item) => item.slug === slug);

  return {
    title: department ? department.name : labels.collectionsTitle,
    /*
      THE SHOP'S OWN WORDS WHEN IT WROTE ANY, and otherwise a sentence that
      says what the page IS rather than a claim about the shop. The stored row
      has a `description` field the Catalog screen offers; most are blank, and
      a blank one is not a gap to fill with invention.
    */
    description:
      department?.description?.trim() ||
      (department
        ? `${labels.productWordPlural} in ${department.name.toLowerCase()}.`
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
    getStorefrontDepartments(),
  ]);

  /*
    THROUGH THE SHARED RULE, so this page cannot open for a department the
    header is not offering. `offeredAxes` drops a department with no categories
    filed under it — which would be a heading over an empty grid — along with
    the switched-off rows and anything whose slug a sibling already holds.
  */
  const offered = offeredAxes({ categories, occasions, collections, departments });
  const department = offered.departments.find((item) => item.slug === slug);

  /*
    An unknown slug falls through to the plain listing rather than 404ing — the
    same thing the occasions and collections routes do, and for the same
    reason: these lists are shop-edited, so a renamed department turns every
    link to it into a mistake, and a full catalogue is a better answer to that
    than a dead end.
  */
  return (
    <CollectionsPage
      catalog={catalog}
      categories={categories}
      department={
        department
          ? {
              name: department.name,
              slug: department.slug,
              description: department.description,
              categoryIds: department.categoryIds,
            }
          : undefined
      }
    />
  );
}
