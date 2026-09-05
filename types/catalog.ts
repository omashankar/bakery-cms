import type { ProductCategory, ProductOccasion } from "./product";

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

  `ProductFlavour` has now gone the same way, for the same reason and with
  one of its own: a flavour was never a thing a shop MAINTAINED, it was a
  word typed on a product. The shop-wide list bought nothing — the storefront
  filter reads the products, and the product form always had its own
  comma-separated box beside the dropdown — and it cost a screen to keep in
  step. `Product.flavourOptions` is where a flavour lives now.
*/

export interface CatalogStore {
  categories: ProductCategory[];
  occasions: ProductOccasion[];
  updatedAt: string;
}

export type CatalogTab = "categories" | "occasions";
