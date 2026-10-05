/** Shared monetary breakdown used in checkout, invoices, and admin order views */
export interface TaxBreakdownValues {
  subtotal: number;
  discount?: number;
  discountLabel?: string;
  delivery: number;
  tax: number;
  taxLabel?: string;
  platformCharge?: number;
  platformChargeLabel?: string;
  giftWrapFee?: number;
  giftWrapLabel?: string;
  /**
   * What the shop says these lines used to cost, minus what they cost now.
   * Only ever from compare-at prices the shop typed; 0 or absent otherwise.
   */
  compareAtSavings?: number;
  deliveryTierFee?: number;
  /** The shop's own word for the chosen speed. Absent when no tier is chosen. */
  deliveryTierLabel?: string;
  taxableAmount?: number;
  total: number;
}
