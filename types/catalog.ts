import type { ProductCategory, ProductFlavour, ProductOccasion } from "./product";

/*
  `CatalogWeightOption` used to sit here: a shop-wide list of sizes with a
  price modifier each, which every product drew its tiers from.

  It is gone because it was the wrong shape for a shop that sells more than
  one kind of thing — a cake shop that also sells chargers had “0.5 kg”
  offered for a charger and nowhere to put a cable length — and because a
  second list is a second thing to keep in step: a size could sit here with no
  product using it, and a product could be sold in a size this had never heard
  of. Sizes are typed on the product now, in `ProductWeight`, which has always
  carried label, price and serves of its own.
*/

export interface CatalogStore {
  categories: ProductCategory[];
  flavours: ProductFlavour[];
  occasions: ProductOccasion[];
  updatedAt: string;
}

export type CatalogTab = "categories" | "flavours" | "occasions";
