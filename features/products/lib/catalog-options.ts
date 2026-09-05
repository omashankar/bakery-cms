/** Catalog options — reads from catalog repository */
import type { ProductWeight } from "@/types/product";
import {
  getCategories,
  getOccasions,
  getCategoryById,
  getCategoryByName,
} from "@/features/catalog/lib/catalog-repository";

export const adminCategories = getCategories;
export const adminOccasions = getOccasions;

/*
  `getDefaultWeights` stood here: the shop-wide Catalog sizes, priced from a
  product's base. Sizes are typed on the product now, so there is nothing left
  to derive them from.
*/

/**
 * Re-price a product's sizes after its base price changes, keeping the gaps.
 *
 * Changing the base price once called `getDefaultWeights(price)` and replaced
 * the whole array, so editing a cake's price by one rupee silently discarded
 * every per-size price the admin had entered — and those are what the customer
 * actually pays. Then it kept the hand-typed ones by comparing each against
 * what the shop-wide Catalog presets would have derived.
 *
 * There is no taxonomy to compare against any more: sizes are typed on the
 * product. So the rule is the one that needs nothing outside the product — every
 * size MOVES WITH THE BASE, by the same amount the base moved.
 *
 * That is what the old rule did for an untouched tier (base+200 followed the
 * base) and it now does it for a hand-typed one too, which is the honest
 * reading: a shop that priced 1 kg at ₹200 over the small one meant ₹200 over,
 * not ₹1,400 for ever. A shop that wants a size pinned edits that row, which is
 * one field away — and for a shop with thirty products, the alternative is
 * re-typing every tier of every product each time a price moves.
 */
export function rederiveWeights(
  current: ProductWeight[],
  nextBasePrice: number,
  previousBasePrice: number
): ProductWeight[] {
  /**
   * A product sold in ONE size stays sold in one size.
   *
   * This once returned `getDefaultWeights(next).map(...)` — every preset the
   * shop had — so a product with no sizes grew three of them on the first
   * keystroke in the Price field, silently undoing the merchant's choice, and
   * clearing the tiers on a phone charger never stuck.
   */
  if (current.length === 0) return [];

  const shift = nextBasePrice - previousBasePrice;
  if (shift === 0) return current;

  return current.map((tier) => ({
    ...tier,
    // Never below zero. A base price cut by more than a size costs would
    // otherwise price it negative — money off for choosing the bigger one.
    price: Math.max(0, tier.price + shift),
  }));
}

export { getCategoryById, getCategoryByName };
