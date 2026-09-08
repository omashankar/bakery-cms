import type { BaseEntity, EntityStatus, SeoFields } from "./common";

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

/**
 * The outlines a customer photograph can be printed inside.
 *
 * Declared here rather than beside the drawing code because it is a fact
 * about the PRODUCT: it crosses the Mongoose schema, the validator, the
 * storefront mapper and the admin form, and only then reaches a canvas.
 * `lib/images/photo-print-layout` holds the geometry for each one.
 */
export type PhotoFrameShapeId = "circle" | "square" | "heart";

/**
 * `shape` joined these when the flat `shapes: string[]` was retired.
 *
 * That list held NAMES with nowhere to put a price, so a shop could say a cake
 * came in Round and Heart and could not charge more for the Heart — and the
 * four names it offered were hardcoded, so a shop wanting “Number” or a bouquet
 * size had no way to say so. A typed group is what egg preference and photo
 * cakes were at the time, so shapes stopped being a second system — and the
 * type is what lets `modules.shape` keep gating them. Those two have since
 * gone, and `shape` is the last typed one left.
 */
export type ProductVariantGroupType = "shape" | "custom";

/*
  `VariantOptionSemantic` stood here — a machine-readable meaning an option
  could carry so business logic branched on it rather than on a merchant's
  label. It had two values, and both were bakery special cases: `eggless`,
  which went when eggless became an ordinary priced option, and `photo-print`,
  which went with the photo-print option itself.

  A product that takes a photograph now says so with `allowsPhotoUpload` and
  prices it into its own price. There is nothing left for an option to MEAN
  that its label and its price do not already say.
*/

export interface ProductVariantOption {
  id: string;
  label: string;
  priceAdjustment: number;
  isDefault?: boolean;
}

export interface ProductVariantGroup {
  id: string;
  name: string;
  type: ProductVariantGroupType;
  /**
   * LEGACY, and inert. Nothing reads it.
   *
   * Its only reader was the admin checkbox that wrote it. No picker blocks on
   * it, and `calculateVariantAdjustment` substitutes the group's default option
   * whenever a selection is absent — so a group marked required was priced and
   * recorded exactly like one that was not, and the merchant was told a
   * purchase would be stopped without a choice that it never stopped.
   *
   * Optional rather than deleted, and for the same reason
   * `PaymentMethodSettings.upi/card` were kept: every stored product, and every
   * backup an owner has taken, already carries it. Optional so a caller that
   * has no opinion — an import, an API client — is not forced to invent one.
   * Do not gate anything on it without making it mean something first.
   */
  required?: boolean;
  options: ProductVariantOption[];
}

/**
 * A fact about the product, in the merchant's own words.
 *
 * Brand: Samsung. Material: Ceramic. Warranty: 1 year. RAM: 8 GB. Not a choice
 * the customer makes and not a price — which is exactly what separates it from
 * `ProductVariantOption`, and why abusing a one-option variant group for it is
 * wrong: the product page renders every group as a row of clickable buttons, so
 * "Brand: Samsung" would read as something to pick, and `formatVariantSummary`
 * would fold it into `variantSummary` and stamp it on the order line as though
 * the customer had chosen it.
 *
 * Deliberately NOT part of `ProductDetails`. Those six are typed food scalars
 * that four formatters consume as numbers — `${calories} kcal / serving`,
 * shelf-life in days — and turning them into label/value strings would make all
 * of that string parsing. They stay; this sits beside them.
 *
 * Optional, because `mapLandingProductToAdmin` builds a whole `Product` literal
 * for the seed and a required field would break it.
 */
/**
 * One labelled list in the product description.
 *
 * Six reference storefronts, six different shapes. A cake had Product Details,
 * Delivery Information, Care Instructions and a Note. A plant had no heading at
 * all over its first list, then Benefits, Disclaimer, Do's and Dont's. A candle
 * called the same two blocks Delivery DETAILS and Care DIRECTIVES.
 *
 * So the headings are not three fixed slots, and they are not shop-wide either:
 * they belong to the PRODUCT, and there can be any number of them. A shop
 * selling cakes and phone chargers writes “our delivery boy hand-delivers it”
 * on one and “shipped by our courier partners, you will get a tracking number”
 * on the other — opposite policies, same shop.
 *
 * `heading` may be blank: two of the six list their facts with no label over
 * them, and a heading nobody typed should not be invented.
 *
 * `body` is one line per bullet, like every other list this project renders —
 * the same rule as the delivery setting, so a shop learns it once. A line that
 * is not `Label: Value` is fine: the reference lists whole sentences beside its
 * key-value pairs.
 */
export interface ProductDescriptionBlock {
  id: string;
  heading: string;
  body: string;
}

/*
  `ProductDetails` stood here, and by the end it was empty.

  It held seven fields a product could state about itself: Barcode / SKU,
  Preparation time, Shelf life, Calories, Ingredients, Allergens and Care
  instructions. The shop asked for all of them to go, and none drove any
  logic — no delivery date was computed from a preparation time, no stock was
  found by barcode, no order was stopped by an allergen. All seven were
  display, and four of them printed a second time as a chip beside the name.

  The shop was told plainly what dropping Allergens costs — a list of what is
  in the food is the one field here where being wrong can hurt somebody — and
  asked for it anyway. It can still say so in a description block, which is
  where everything a shop wants stated now goes.

  Care instructions were the last to leave, and not because they were wrong:
  they were one free-text box under one fixed heading, and six reference
  storefronts wanted Care Instructions, Care Directives, Do's and Dont's. A
  block carries its own heading, so the shop names it.
*/
export interface Product extends BaseEntity {
  name: string;
  slug: string;
  description: string;
  /*
    `shortDescription` stood here, and it was not a description.

    Nothing on the storefront ever rendered it. Its one destination was the
    META description, as the middle link of a three-step fallback:

      seo.metaDescription  ->  shortDescription  ->  description

    So it duplicated the SEO tab's own box, under a name that promised a
    summary customers would read, in the tab about what a product IS. A shop
    wanting a shorter line for Google has the field for it; a shop that does
    not now falls straight through to the description, which is what the last
    step always was.

    The seed set it to `description.slice(0, 100)` — a truncation of the very
    field it fell through to — so it carried nothing of its own for any
    product this shop has.
  */
  price: number;
  compareAtPrice?: number;
  images: string[];
  categoryId: string;
  occasionIds: string[];
  weights: ProductWeight[];
  /** What this product's size tiers are CALLED. Blank means the generic word. */
  weightLabel?: string;
  status: EntityStatus;
  isFeatured: boolean;
  isBestSeller: boolean;
  isTrending: boolean;
  shapes: string[];
  flavourOptions: string[];
  stockStatus: StockStatus;
  stockQuantity: number;
  unlimitedStock: boolean;
  lowStockThreshold?: number;
  allowsMessage: boolean;
  allowsPhotoUpload: boolean;
  /**
   * Which shape the customer's photograph is printed in.
   *
   * A print area is GEOMETRY — the browser has to clip to it — so unlike a
   * size or an option label the shop picks from a list rather than typing its
   * own. Absent means round, which is what every photo product printed before
   * there was a choice.
   */
  photoFrameShape?: PhotoFrameShapeId;
  variantGroups: ProductVariantGroup[];
  /**
   * The product description, as the shop writes it. See
   * ProductDescriptionBlock — never a choice, never priced.
   *
   * This was `attributes: { label, value }[]`, which could only say
   * "Brand: Samsung" and had exactly one heading above the lot. Two of the
   * six reference pages need no heading, one needs five, and none of them
   * keeps to Label: Value throughout.
   */
  descriptionBlocks?: ProductDescriptionBlock[];
  rating: number;
  reviewCount: number;
  seo: SeoFields;
}

export interface ProductWeight {
  label: string;
  price: number;
  serves?: string;
}

export interface ProductCategory extends BaseEntity {
  name: string;
  slug: string;
  description?: string;
  image?: string;
  cakeCount?: number;
}


export interface ProductOccasion extends BaseEntity {
  name: string;
  slug: string;
}

export type ProductFormData = Omit<Product, "id" | "createdAt" | "updatedAt">;
