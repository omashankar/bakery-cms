import type { ProductVariantGroup } from "@/types/product";
import { calculateVariantAdjustment } from "@/features/products/lib/variant-utils";

export interface ProductPriceInput {
  basePrice: number;
  weightPrice?: number;
  variantGroups?: ProductVariantGroup[];
  variantSelections?: Record<string, string>;
}

export function resolveWeightPrice(basePrice: number, weightPrice?: number, weightModifier?: number): number {
  if (typeof weightPrice === "number") return weightPrice;
  return basePrice + (weightModifier ?? 0);
}

export function calculateProductUnitPrice(input: ProductPriceInput): number {
  const weightPrice = resolveWeightPrice(input.basePrice, input.weightPrice);
  const variantAdjustment = input.variantGroups?.length
    ? calculateVariantAdjustment(input.variantGroups, input.variantSelections ?? {})
    : 0;

  return Math.max(0, weightPrice + variantAdjustment);
}

/**
 * What the shop will charge for this cake with nothing chosen — the number a
 * catalogue card has to show.
 *
 * `product.price` is the BASE, and the server does not charge the base. With no
 * selections it still applies each variant group's default option, and the
 * default's `priceAdjustment` is frequently not zero: this shop's four eggless
 * cakes default to an "Eggless" option that adds ₹80. The cards showed ₹1,099
 * and the shop charged ₹1,179, so a customer who added one from a grid met
 * "Prices have changed" at the last step of checkout, for a choice they had
 * never made.
 *
 * Mirrors `priceLine` in features/checkout/server/pricing.server.ts, which is
 * the authority. The weight tier is index 0 for the same reason it is there:
 * no label means the customer has not picked a size, so the default tier
 * applies.
 */
export function defaultProductUnitPrice(cake: {
  price: number;
  weights?: Array<{ price?: number }>;
  variantGroups?: ProductVariantGroup[];
}): number {
  /**
   * A tier priced 0 is a tier with no price on it, not a free cake.
   *
   * The storefront's card payload carries weight tiers for the FILTER only and
   * zeroes their prices to keep the payload small — `toCard` in
   * products-service.ts. Reading that as an absolute price made every card in
   * the shop render ₹0, which is how this guard came to be here.
   */
  const tierPrice = cake.weights?.[0]?.price;

  return calculateProductUnitPrice({
    basePrice: cake.price,
    weightPrice: tierPrice ? tierPrice : undefined,
    variantGroups: cake.variantGroups,
    variantSelections: {},
  });
}

/**
 * What the shop calls the axis its `weights` are tiers of.
 *
 * The picker was headed with the literal “Weight”, so a shop selling
 * t-shirts got “Weight: S / M / L” and one selling storage got “Weight:
 * 128 GB”. A variant group has carried a shop-typed `name` all along; this
 * gives the first axis the same, and every surface reads it from here.
 *
 * The fallback is deliberately generic, for the same reason `DEFAULT_LABELS`
 * says “Product” and not “Cake”: a default naming one trade is the same bug
 * as a hard-coded one, just written in a nicer place. Nothing prefills it.
 */
export const DEFAULT_SIZE_AXIS_LABEL = "Size";

export function weightAxisLabel(label?: string): string {
  return label?.trim() || DEFAULT_SIZE_AXIS_LABEL;
}

export function formatVariantSummary(
  groups: ProductVariantGroup[],
  selections: Record<string, string>
): string[] {
  return groups
    .map((group) => {
      const optionId = selections[group.id];
      // No selection and no default means the customer opted OUT of this
      // group, and a line that named an option anyway would tell the kitchen
      // to make something nobody asked for.
      const option =
        group.options.find((item) => item.id === optionId) ??
        group.options.find((item) => item.isDefault);
      return option ? `${group.name}: ${option.label}` : null;
    })
    .filter((value): value is string => Boolean(value));
}

/**
 * The struck-through price, moved by whatever moved the price beside it.
 *
 * `compareAtPrice` is ONE number on the product, and the price next to it
 * changes with the size and every option. So a Rs 800 cake with a Rs 1,000
 * compare-at showed "20% OFF" at half a kilo; pick a kilo and `compareAtPrice >
 * price` stopped being true, and the strike and the badge SILENTLY VANISHED —
 * the shop's discount disappearing at exactly the sizes it most wanted to sell.
 * At a kilo and a half the cake cost more than its own stated compare-at, with
 * nothing shown at all. The same thing happens on every grid card, where a
 * default eggless option adds to the price and not to the compare-at.
 *
 * The delta is kept CONSTANT rather than the percentage. A shop states one
 * saving — "normally 1,000, yours for 800" — and that is a rupee amount; adding
 * a Rs 150 heart shape to both sides keeps the saving the shop actually offered,
 * while scaling it would invent a bigger discount at every larger size than the
 * shop ever agreed to. The percentage therefore falls as the price rises, which
 * is the honest direction and the one the reference storefront takes.
 *
 * Returns undefined where there is nothing to strike through, so a caller can
 * pass it straight on.
 */
export function displayCompareAtPrice(
  basePrice: number,
  compareAtPrice: number | undefined,
  displayPrice: number,
): number | undefined {
  if (compareAtPrice == null) return undefined;
  // A compare-at at or below the base is not a discount, and shifting it would
  // turn "we charge more than we say we do" into a badge. This shop has three
  // products in exactly that state.
  if (compareAtPrice <= basePrice) return undefined;

  return compareAtPrice + (displayPrice - basePrice);
}
