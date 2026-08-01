import { fractionDigits } from "@/features/settings/lib/active-locale";
import type { CommerceSettings } from "@/types/settings";

export interface TaxComputationInput {
  subtotal: number;
  discount?: number;
  delivery?: number;
  /**
   * Gift wrap, which is part of what is being taxed.
   *
   * It used to be added to the total AFTER tax and left out of the base
   * entirely — so an invoice headed "Tax Invoice" charged for gift wrap on one
   * line and taxed everything except it. Packing charged to the recipient is
   * part of the value of the supply (CGST s.15(2)(c)), and unlike delivery
   * there was never a setting saying otherwise: it was simply missed.
   */
  giftWrapFee?: number;
  /**
   * The shop's currency, so tax rounds to that currency's minor unit.
   *
   * Rupees are conventionally whole, which is why this rounded to whole units
   * unconditionally — correct for INR and wrong for every other currency the
   * admin's own currency picker offers. A $100 cart at 8.25% was invoiced $8.
   */
  currency?: string;
}

export interface TaxComputationResult {
  taxableAmount: number;
  tax: number;
  platformCharge: number;
  /**
   * The rate this amount was actually computed at.
   *
   * Recorded on the order so a later rate change cannot relabel history: every
   * invoice surface reads the CURRENT `taxLabel`, so raising 5% to 18% rewrote
   * the stated rate on every invoice already issued while the stored amount
   * stayed put — a document asserting a rate that was never charged.
   */
  taxRate: number;
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
  const giftWrapFee = input.giftWrapFee ?? 0;
  const productTaxable = Math.max(input.subtotal - discount, 0);
  const taxableAmount =
    (commerce.taxIncludeDelivery ? productTaxable + delivery : productTaxable) + giftWrapFee;
  // A rate outside 0–1 is not a rate. The admin input clamps to 0–100% and the
  // Zod schema bounds the field, but neither governs what is already at rest in
  // Mongo — a document written before those existed, or by hand — and this
  // function is what turns it into money.
  const taxRate = clampRate(commerce.taxRate);
  const tax = commerce.taxEnabled
    ? roundMoney(taxableAmount * taxRate, input.currency)
    : 0;
  const platformCharge = commerce.platformChargeEnabled ? commerce.platformChargeAmount : 0;

  return {
    taxableAmount,
    tax,
    platformCharge,
    // Zero when tax is off, so the recorded rate always explains the recorded
    // amount rather than describing a setting that was not applied.
    taxRate: commerce.taxEnabled ? taxRate : 0,
  };
}

function clampRate(rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  return Math.min(rate, 1);
}

/** Rounds to the currency's minor unit — whole rupees, cents elsewhere. */
function roundMoney(value: number, currency?: string): number {
  const digits = fractionDigits(currency ?? DEFAULT_TAX_CURRENCY);
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * What to round to when the caller did not say.
 *
 * Every existing caller priced in rupees, so this keeps their arithmetic
 * identical; only a caller that passes a currency gets minor units.
 */
const DEFAULT_TAX_CURRENCY = "INR";

/**
 * The rate as a percentage string.
 *
 * `Math.round(rate * 1000) / 10` keeps one decimal, which is all the admin's
 * 0.1-step input can produce — but a rate that arrived from anywhere else
 * (an import, a hand-edited document) was silently restated: 8.25% printed as
 * "8.3%" on the invoice. Two decimals covers real tax rates, and trailing
 * zeroes are dropped so the ordinary 5% does not become "5.00%".
 *
 * The ternary this replaced returned the same string in both branches.
 */
export function formatTaxRatePercent(rate: number): string {
  const percent = Math.round(rate * 10000) / 100;
  return `${Number(percent.toFixed(2))}%`;
}

export function buildDefaultTaxLabel(rate: number): string {
  return `GST (${formatTaxRatePercent(rate)})`;
}

/**
 * True when the label is still the one this file derived for that rate.
 *
 * The Taxes screen re-derives the label on every rate change, which is right
 * for the default "GST (5%)" and wrong for a shop that typed its own — "VAT",
 * "Service tax", a bilingual label. Their wording was overwritten silently the
 * next time anyone touched the rate.
 */
export function isDerivedTaxLabel(label: string, rate: number): boolean {
  return !label.trim() || label === buildDefaultTaxLabel(rate);
}

/** The tax fields an already-placed order carries. */
interface StoredTaxTotals {
  tax?: number;
  taxableAmount?: number;
  taxRate?: number;
  taxLabel?: string;
}

/**
 * The tax label for an order that has ALREADY been placed.
 *
 * Every surface that prints a tax line — the invoice, the customer's copy, the
 * order detail page, the admin list — read `commerce.taxLabel`, which is the
 * rate the shop charges TODAY. And the label is auto-derived from the rate, so
 * moving 5% to 18% rewrote the stated rate on every invoice already issued
 * while the stored amount stayed where it was: "GST (18%) ₹50" against a
 * ₹1,000 supply, a document asserting a rate that was never charged.
 *
 * Orders placed from now on carry their own label. For everything already in
 * the database the rate is still recoverable — `taxableAmount` has always been
 * stored — so it is derived rather than guessed. When that derived rate agrees
 * with what the shop charges today the current label is used verbatim, which
 * keeps the ordinary unchanged-rate case reading exactly as before.
 */
export function historicalTaxLabel(
  totals: StoredTaxTotals | null | undefined,
  currentLabel: string,
  currentRate?: number,
  currency?: string,
): string {
  // The label as it was written at placement. Exact, and the only branch that
  // needs no reasoning about rounding.
  if (totals?.taxLabel) return totals.taxLabel;

  const stored = totals?.taxRate;
  if (typeof stored === "number" && Number.isFinite(stored) && stored > 0) {
    return relabel(currentLabel, stored);
  }

  const tax = Number(totals?.tax) || 0;
  const taxable = Number(totals?.taxableAmount) || 0;
  // No tax, or an order too old to carry a taxable amount: nothing here
  // contradicts the current label, so leave it alone.
  if (tax <= 0 || taxable <= 0) return currentLabel;

  // A rate DERIVED from money that was already rounded is only as precise as
  // that rounding allowed.
  //
  // The first version of this compared the derived rate against today's with a
  // fixed 0.001 tolerance, which is far tighter than the error it had to
  // absorb. `tax` is rounded to the currency's minor unit, so it can be off by
  // half a unit — on a ₹10 taxable amount, 5% stores as ₹1 and derives as 10%.
  // The invoice would then have asserted "GST (10%)": a rate that was never
  // charged, printed with more confidence than the original bug it replaced.
  const halfUnit = 0.5 / 10 ** fractionDigits(currency ?? DEFAULT_TAX_CURRENCY);
  const uncertainty = halfUnit / taxable;
  const derived = tax / taxable;

  // Consistent with what the shop charges today, once the rounding is allowed
  // for. Its own wording wins — it may not be called GST at all.
  if (
    typeof currentRate === "number" &&
    Number.isFinite(currentRate) &&
    Math.abs(derived - currentRate) <= uncertainty + 1e-9
  ) {
    return currentLabel;
  }

  // The rates genuinely differ. Only state one when the derivation is precise
  // enough to be worth stating: below a tenth of a percent of slack, which needs
  // a taxable amount of a few hundred rupees. Under that, say that tax was
  // charged and let the printed taxable amount speak for the rate — an honest
  // omission beats a confident guess on a document someone files.
  if (uncertainty > 0.001) return stripRate(currentLabel) || "Tax";

  return relabel(currentLabel, derived);
}

/**
 * The shop's own wording, carrying a different rate.
 *
 * This used to be `buildDefaultTaxLabel`, which hardcodes "GST" — so a shop in
 * a country that has never heard of GST had its historical invoices relabelled
 * with a tax it does not charge. The name comes from what the shop calls it
 * today; only the percentage is replaced.
 */
function relabel(currentLabel: string, rate: number): string {
  const name = stripRate(currentLabel);
  return name ? `${name} (${formatTaxRatePercent(rate)})` : buildDefaultTaxLabel(rate);
}

/** "GST (18%)" → "GST"; "VAT" → "VAT"; "" → "". */
function stripRate(label: string): string {
  return label.replace(/\s*\([^)]*%\s*\)\s*/g, " ").trim();
}
