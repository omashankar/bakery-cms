import type { ProductVariantGroup } from "@/types/cake";
import { calculateVariantAdjustment } from "@/features/admin/cakes/lib/variant-utils";

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

export function formatVariantSummary(
  groups: ProductVariantGroup[],
  selections: Record<string, string>
): string[] {
  return groups
    .map((group) => {
      const optionId = selections[group.id];
      const option =
        group.options.find((item) => item.id === optionId) ??
        group.options.find((item) => item.isDefault) ??
        group.options[0];
      return option ? `${group.name}: ${option.label}` : null;
    })
    .filter((value): value is string => Boolean(value));
}
