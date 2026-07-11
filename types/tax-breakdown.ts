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
  taxableAmount?: number;
  total: number;
}
