/** Catalog options — reads from catalog repository */
import type { ProductWeight } from "@/types/product";
import {
  getCategories,
  getFlavours,
  getOccasions,
  getCategoryById,
  getCategoryByName,
  getFlavourByName,
  getWeightOptions,
} from "@/features/catalog/lib/catalog-repository";
import { weightsToProductWeights } from "@/features/catalog/lib/catalog-utils";

export const adminCategories = getCategories;
export const adminFlavours = getFlavours;
export const adminOccasions = getOccasions;

export function getDefaultWeights(basePrice: number): ProductWeight[] {
  return weightsToProductWeights(basePrice, getWeightOptions());
}

/**
 * Re-price the weight tiers after a base-price change, keeping hand-typed ones.
 *
 * Changing the base price used to call `getDefaultWeights(price)` and replace
 * the whole array, so editing a cake's price by one rupee silently discarded
 * every per-weight price the admin had entered — and those tiers are what the
 * customer actually pays. A shop that had priced 2 kg deliberately lost it by
 * correcting a typo in the base.
 *
 * A tier counts as hand-typed when its price is not what the OLD base price
 * would have derived for it. Matching is by label rather than position, so a
 * catalog weight added or removed in between does not shift the comparison onto
 * the wrong tier.
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
   * shop has — so a product with no tiers grew three of them on the first
   * keystroke in the Price field, silently undoing the merchant's choice, and
   * clearing the tiers on a phone charger never stuck.
   *
   * The walk below is over `current` now, so it would answer `[]` here on its
   * own; this stays as an early exit, not as the guarantee. What it saves is
   * two reads of the catalog — which go through localStorage — for every
   * keystroke in the Price field of a product that has no sizes at all.
   */
  if (current.length === 0) return [];

  const previousDerived = new Map(
    getDefaultWeights(previousBasePrice).map((tier) => [tier.label, tier.price])
  );
  const byLabel = new Map(current.map((tier) => [tier.label, tier]));

  /**
   * THE PRODUCT'S OWN TIERS, re-priced. Not the catalog's.
   *
   * This mapped over `getDefaultWeights(next)` — every preset the shop has —
   * so a product sold in two sizes grew back to all of them on the first
   * keystroke in the Price field. Removing a size a product is not sold in
   * could not stick: correcting a typo in the base price put it back, priced
   * and orderable, and the shop had no way to tell.
   *
   * Which sizes a product comes in is the product's answer. What each one
   * costs when the shop has not said otherwise is the catalog's, and that is
   * all this takes from it.
   */
  const derivedNow = new Map(
    getDefaultWeights(nextBasePrice).map((tier) => [tier.label, tier]),
  );

  return current.map((tier) => {
    const derived = derivedNow.get(tier.label);
    // A tier the catalog no longer knows about — the shop deleted the preset
    // — keeps whatever it was given. There is nothing to re-derive it from,
    // and dropping it would delete a size the product is genuinely sold in.
    if (!derived) return tier;

    const wasDerived = tier.price === previousDerived.get(tier.label);
    return wasDerived ? derived : { ...derived, price: tier.price };
  });
}

export { getCategoryById, getCategoryByName, getFlavourByName };
