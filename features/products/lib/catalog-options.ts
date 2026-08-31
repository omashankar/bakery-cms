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
   * This always returned `getDefaultWeights(next).map(...)` — the shop's catalog
   * presets — so a product with no tiers grew three of them on the first
   * keystroke in the Price field, silently undoing the merchant's choice. It is
   * the reason clearing the tiers on a phone charger never stuck.
   */
  if (current.length === 0) return [];

  const previousDerived = new Map(
    getDefaultWeights(previousBasePrice).map((tier) => [tier.label, tier.price])
  );
  const byLabel = new Map(current.map((tier) => [tier.label, tier]));

  return getDefaultWeights(nextBasePrice).map((tier) => {
    const existing = byLabel.get(tier.label);
    if (!existing) return tier;

    const wasDerived = existing.price === previousDerived.get(tier.label);
    return wasDerived ? tier : { ...tier, price: existing.price };
  });
}

export { getCategoryById, getCategoryByName, getFlavourByName };
