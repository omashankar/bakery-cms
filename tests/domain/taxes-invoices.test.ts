/**
 * Taxes, invoices and the order-settings rules that decide them.
 *
 * Each block pins one defect found by auditing those three admin screens. Every
 * test here was checked by reintroducing the bug it describes and confirming it
 * fails — a test that passes against the broken code pins nothing.
 */
import { describe, expect, it } from "vitest";

import {
  buildDefaultTaxLabel,
  computeTaxAmount,
  formatTaxRatePercent,
  historicalTaxLabel,
  isDerivedTaxLabel,
} from "@/features/commerce/lib/tax-utils";
import { checkMinimumOrder } from "@/features/checkout/lib/minimum-order";
import { calculateCartTotals } from "@/features/orders/lib/cart-totals";
import { defaultInvoiceSettings } from "@/features/commerce/lib/invoice-defaults";
import { defaultCommerceSettings } from "@/features/settings/lib/settings-utils";

const taxable = {
  ...defaultCommerceSettings,
  taxEnabled: true,
  taxRate: 0.05,
  taxIncludeDelivery: false,
  platformChargeEnabled: false,
  giftWrapEnabled: true,
  giftWrapFee: 100,
};

describe("what the tax is charged ON", () => {
  it("includes gift wrap in the taxable amount", () => {
    // Gift wrap was added to the total AFTER tax and left out of the base
    // entirely, so an invoice headed "Tax Invoice" charged for it on one line
    // and taxed everything except it. Packing charged to the recipient is part
    // of the value of the supply.
    const { taxableAmount, tax } = computeTaxAmount(taxable, {
      subtotal: 1000,
      giftWrapFee: 100,
    });

    expect(taxableAmount).toBe(1100);
    expect(tax).toBe(55);
  });

  it("still honours the delivery toggle alongside it", () => {
    const withDelivery = computeTaxAmount(
      { ...taxable, taxIncludeDelivery: true },
      { subtotal: 1000, delivery: 50, giftWrapFee: 100 },
    );
    expect(withDelivery.taxableAmount).toBe(1150);

    const withoutDelivery = computeTaxAmount(taxable, {
      subtotal: 1000,
      delivery: 50,
      giftWrapFee: 100,
    });
    expect(withoutDelivery.taxableAmount).toBe(1100);
  });

  it("takes the discount off before taxing, and never goes negative", () => {
    const { taxableAmount } = computeTaxAmount(taxable, { subtotal: 100, discount: 500 });
    expect(taxableAmount).toBe(0);
  });

  it("carries gift wrap through the cart totals, taxed and charged once", () => {
    const totals = calculateCartTotals({
      items: [{ price: 1000, quantity: 1 } as never],
      giftWrap: true,
      commerceOverride: { ...taxable, deliveryFee: 0, freeDeliveryThreshold: 0 },
    });

    expect(totals.giftWrapFee).toBe(100);
    expect(totals.taxableAmount).toBe(1100);
    expect(totals.tax).toBe(55);
    // Charged as a line AND taxed — not taxed twice into the total.
    expect(totals.total).toBe(1000 + 100 + 55);
  });
});

describe("how the tax is rounded", () => {
  it("rounds to whole units for rupees", () => {
    const { tax } = computeTaxAmount({ ...taxable, taxRate: 0.05 }, {
      subtotal: 849,
      currency: "INR",
    });
    // 42.45 → 42
    expect(tax).toBe(42);
  });

  it("keeps minor units for a currency that has them", () => {
    // `Math.round` was unconditional, which is right for rupees and wrong for
    // every other currency the admin's own currency picker offers: a $100 cart
    // at 8.25% was invoiced $8.
    const { tax } = computeTaxAmount({ ...taxable, taxRate: 0.0825 }, {
      subtotal: 100,
      currency: "USD",
    });
    expect(tax).toBe(8.25);
  });

  it("defaults to rupees when no currency is given, so existing callers are unchanged", () => {
    const { tax } = computeTaxAmount({ ...taxable, taxRate: 0.0825 }, { subtotal: 100 });
    expect(tax).toBe(8);
  });
});

describe("a tax rate that is not a rate", () => {
  it("clamps a stored rate above 100% instead of turning it into money", () => {
    // The admin input clamps and the Zod schema bounds the field, but neither
    // governs what is already at rest in Mongo — and this function is what
    // turns it into a number the customer is charged.
    const { tax, taxRate } = computeTaxAmount({ ...taxable, taxRate: 5 }, { subtotal: 1000 });
    expect(taxRate).toBe(1);
    expect(tax).toBe(1000);
  });

  it("treats a negative or non-finite rate as no tax", () => {
    expect(computeTaxAmount({ ...taxable, taxRate: -0.5 }, { subtotal: 1000 }).tax).toBe(0);
    expect(computeTaxAmount({ ...taxable, taxRate: NaN }, { subtotal: 1000 }).tax).toBe(0);
  });

  it("reports a zero rate when tax is switched off, so the rate explains the amount", () => {
    const off = computeTaxAmount({ ...taxable, taxEnabled: false }, { subtotal: 1000 });
    expect(off.tax).toBe(0);
    expect(off.taxRate).toBe(0);
  });
});

describe("the rate a percentage string claims", () => {
  it("keeps two decimals rather than restating the rate", () => {
    // `Math.round(rate * 1000) / 10` printed 8.25% as "8.3%" — a rate the
    // invoice then asserted and the arithmetic did not support.
    expect(formatTaxRatePercent(0.0825)).toBe("8.25%");
  });

  it("does not decorate a whole percentage with zeroes", () => {
    expect(formatTaxRatePercent(0.05)).toBe("5%");
    expect(formatTaxRatePercent(0.18)).toBe("18%");
    expect(formatTaxRatePercent(0)).toBe("0%");
  });
});

describe("the label on an invoice already issued", () => {
  const currentLabel = "GST (18%)";
  const currentRate = 0.18;

  it("prints the rate the order was CHARGED at, not the one the shop charges now", () => {
    // January: 5% on ₹1,000 = ₹50. April: the admin moves the rate to 18%, and
    // the label — which is auto-derived from the rate — moves with it. Every
    // invoice already issued then read "GST (18%) ₹50" against a ₹1,000 supply.
    const january = { tax: 50, taxableAmount: 1000, taxRate: 0.05, taxLabel: "GST (5%)" };
    expect(historicalTaxLabel(january, currentLabel, currentRate)).toBe("GST (5%)");
  });

  it("recovers the rate for an order placed before the rate was stored", () => {
    // `taxableAmount` has always been recorded, so on an order large enough for
    // the rounding not to matter the charged rate is derived rather than guessed.
    const legacy = { tax: 50, taxableAmount: 1000 };
    expect(historicalTaxLabel(legacy, currentLabel, currentRate)).toBe("GST (5%)");
  });

  it("keeps the shop's own wording when the stored rate agrees with today's", () => {
    // The shop may not call it GST at all, so an agreeing rate must not be
    // rewritten into this file's default phrasing.
    const shopLabel = "VAT";
    const agreeing = { tax: 180, taxableAmount: 1000 };
    expect(historicalTaxLabel(agreeing, shopLabel, currentRate)).toBe("VAT");
  });

  it("carries the shop's own tax NAME onto a restated rate", () => {
    // The first version built the label with `buildDefaultTaxLabel`, which
    // hardcodes "GST" — so a shop that charges "Sales tax" had its historical
    // invoices relabelled with a tax it has never charged.
    const january = { tax: 50, taxableAmount: 1000 };
    expect(historicalTaxLabel(january, "Sales tax (18%)", 0.18)).toBe("Sales tax (5%)");
    expect(historicalTaxLabel(january, "VAT", 0.18)).toBe("VAT (5%)");
  });

  it("does NOT invent a rate the rounded amount cannot support", () => {
    // 5% of ₹10 is ₹0.50, stored as ₹1. Deriving gives 10% — a rate that was
    // never charged, asserted on a document someone files. The first version
    // compared with a fixed 0.001 tolerance, far tighter than the half-rupee of
    // rounding it had to absorb, and printed "GST (10%)".
    const tiny = { tax: 1, taxableAmount: 10 };
    expect(historicalTaxLabel(tiny, "GST (18%)", 0.18)).toBe("GST");
    expect(historicalTaxLabel(tiny, "VAT", 0.18)).toBe("VAT");
  });

  it("still recognises today's rate on a small order, within the rounding", () => {
    // 18% of ₹10 is ₹1.80, stored as ₹2 → derives 20%. That is CONSISTENT with
    // 18% once half a rupee of rounding is allowed for, so the shop's own label
    // is correct and must be kept rather than restated.
    expect(historicalTaxLabel({ tax: 2, taxableAmount: 10 }, "GST (18%)", 0.18)).toBe(
      "GST (18%)",
    );
  });

  it("uses the currency's minor unit to judge how coarse the rounding was", () => {
    // In cents the same arithmetic is 100× finer, so a derived rate there IS
    // trustworthy where the rupee equivalent would not be.
    const cents = { tax: 8.25, taxableAmount: 100 };
    expect(historicalTaxLabel(cents, "Sales tax (10%)", 0.1, "USD")).toBe("Sales tax (8.25%)");
  });

  it("falls back to the current label when there is nothing to contradict it", () => {
    expect(historicalTaxLabel({ tax: 0, taxableAmount: 0 }, currentLabel, currentRate)).toBe(
      currentLabel,
    );
    expect(historicalTaxLabel(null, currentLabel, currentRate)).toBe(currentLabel);
  });

  it("records the rate and label on a freshly priced cart", () => {
    const totals = calculateCartTotals({
      items: [{ price: 1000, quantity: 1 } as never],
      commerceOverride: { ...taxable, taxLabel: "GST (5%)", deliveryFee: 0 },
    });
    expect(totals.taxRate).toBe(0.05);
    expect(totals.taxLabel).toBe("GST (5%)");
  });
});

describe("re-deriving the tax label when the rate changes", () => {
  it("replaces the label while it is still the derived one", () => {
    expect(isDerivedTaxLabel(buildDefaultTaxLabel(0.05), 0.05)).toBe(true);
    expect(isDerivedTaxLabel("", 0.05)).toBe(true);
  });

  it("leaves a label the shop typed alone", () => {
    // Rewriting "VAT" or "Service tax" back to "GST (n%)" on every rate change
    // discarded the shop's own wording silently.
    expect(isDerivedTaxLabel("VAT", 0.05)).toBe(false);
    expect(isDerivedTaxLabel("Service tax", 0.05)).toBe(false);
  });
});

describe("the shop's minimum order value", () => {
  it("refuses a cart below it and says how much is missing", () => {
    // Enforced only in the browser — a disabled Pay button and a toast — so a
    // direct POST placed orders under it all day.
    const check = checkMinimumOrder(300, 500);
    expect(check.below).toBe(true);
    expect(check.shortfall).toBe(200);
  });

  it("accepts a cart exactly at the minimum", () => {
    expect(checkMinimumOrder(500, 500).below).toBe(false);
  });

  it("treats zero, negative and unset as no minimum — the admin field says so", () => {
    expect(checkMinimumOrder(1, 0).below).toBe(false);
    expect(checkMinimumOrder(1, -100).below).toBe(false);
    expect(checkMinimumOrder(1, NaN).below).toBe(false);
  });
});

describe("what an unconfigured shop prints on an invoice", () => {
  it("carries no tax registration number it did not enter", () => {
    // These were a well-formed, plausible GSTIN and PAN belonging to nobody.
    // Any surface falling back to these defaults — and the customer's copy
    // always did — issued a tax document asserting an invented registration.
    expect(defaultInvoiceSettings.gstNumber).toBe("");
    expect(defaultInvoiceSettings.panNumber).toBe("");
    expect(defaultInvoiceSettings.showGstNumber).toBe(false);
    expect(defaultInvoiceSettings.showPanNumber).toBe(false);
  });

  it("does not call itself a tax invoice before there is a registration to put on one", () => {
    expect(defaultInvoiceSettings.invoiceTitle).toBe("Invoice");
  });

  it("does not tell the customer tax is included when it is added on top", () => {
    // The pricing pipeline returns a separate `tax` and the total is
    // `subtotal + … + tax`, so "GST is included where applicable" contradicted
    // the breakdown printed directly above it.
    expect(defaultInvoiceSettings.termsAndConditions).not.toMatch(/included/i);
  });
});
