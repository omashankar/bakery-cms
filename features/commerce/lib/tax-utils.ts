import type { CommerceSettings } from "@/types/settings";

export interface TaxComputationInput {
  subtotal: number;
  discount?: number;
  delivery?: number;
}

export interface TaxComputationResult {
  taxableAmount: number;
  tax: number;
  platformCharge: number;
}

export type TaxSettings = Pick<
  CommerceSettings,
  | "taxEnabled"
  | "taxRate"
  | "taxLabel"
  | "taxIncludeDelivery"
  | "platformChargeEnabled"
  | "platformChargeLabel"
  | "platformChargeAmount"
>;

export function extractTaxSettings(commerce: CommerceSettings): TaxSettings {
  return {
    taxEnabled: commerce.taxEnabled,
    taxRate: commerce.taxRate,
    taxLabel: commerce.taxLabel,
    taxIncludeDelivery: commerce.taxIncludeDelivery,
    platformChargeEnabled: commerce.platformChargeEnabled,
    platformChargeLabel: commerce.platformChargeLabel,
    platformChargeAmount: commerce.platformChargeAmount,
  };
}

export function computeTaxAmount(
  commerce: TaxSettings | CommerceSettings,
  input: TaxComputationInput
): TaxComputationResult {
  const discount = input.discount ?? 0;
  const delivery = input.delivery ?? 0;
  const productTaxable = Math.max(input.subtotal - discount, 0);
  const taxableAmount = commerce.taxIncludeDelivery
    ? productTaxable + delivery
    : productTaxable;
  const tax = commerce.taxEnabled ? Math.round(taxableAmount * commerce.taxRate) : 0;
  const platformCharge = commerce.platformChargeEnabled ? commerce.platformChargeAmount : 0;

  return {
    taxableAmount,
    tax,
    platformCharge,
  };
}

export function formatTaxRatePercent(rate: number): string {
  const percent = Math.round(rate * 1000) / 10;
  return Number.isInteger(percent) ? `${percent}%` : `${percent}%`;
}

export function buildDefaultTaxLabel(rate: number): string {
  return `GST (${formatTaxRatePercent(rate)})`;
}
