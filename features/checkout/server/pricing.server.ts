import * as productRepo from "@/features/products/server/product.repository";
import { getSettings } from "@/features/settings/server/settings.service";
import { getCoupons, getZones } from "@/features/commerce/server/commerce.service";
import { calculateCartTotals, type CartTotals } from "@/features/orders/lib/cart-totals";
import { getProductWeightOptions } from "@/features/products/lib/product-catalog";
import { getProductVariantGroups } from "@/apps/website/lib/product-details";
import { calculateProductUnitPrice } from "@/features/products/lib/product-pricing";
import { resolveCouponDiscount } from "@/features/orders/lib/coupons";
import type { CommerceSettings, GeneralSettings } from "@/types/settings";
import type { LandingProduct } from "@/constants/landing-data";
import type { DeliveryZone } from "@/types/delivery";

/**
 * Prices a cart on the SERVER, from the shop's own records.
 *
 * Everything about the money used to be chosen by the caller.
 * `cartItemSchema.price` and `totalsSchema.total` were stored verbatim, and
 * `POST /api/razorpay/order` took `amount` from the request body — so a
 * 5000-rupee cake could be ordered, and genuinely paid for, at 1 rupee.
 *
 * The pricing functions were always pure and always server-callable; nothing
 * ever called them here. `calculateCartTotals` already accepted a
 * `commerceOverride`, and `calculateProductUnitPrice` takes plain data. What was
 * missing was a caller that reads the PRODUCT and the SETTINGS from Mongo rather
 * than from the browser — which also fixes a quieter bug, that the client priced
 * against whatever commerce settings that browser had last hydrated.
 *
 * The client still sends what it CHOSE — the slug, quantity, weight label and
 * variant selections. It no longer sends what those choices cost.
 */
export interface QuoteLineInput {
  productSlug: string;
  quantity: number;
  /** The weight OPTION's label, as shown to the customer. */
  weight?: string;
  flavour?: string;
  shape?: string;
  message?: string;
  deliveryDate?: string;
  deliveryTime?: string;
  variantSelections?: Record<string, string>;
}

export interface QuoteInput {
  items: QuoteLineInput[];
  couponCode?: string;
  giftWrap?: boolean;
  deliveryAddress?: { city?: string; pincode?: string };
}

export interface QuotedLine extends QuoteLineInput {
  name: string;
  image: string;
  /** The unit price the SHOP says, for the options chosen. */
  price: number;
  variantSummary?: string[];
}

export interface CartQuote {
  items: QuotedLine[];
  totals: CartTotals;
  coupon: { code: string; discountAmount: number } | null;
  /** Codes the caller sent that the shop does not honour, for reporting back. */
  rejectedCoupon?: string;
  commerce: CommerceSettings;
  /**
   * The shop's currency, from General settings.
   *
   * Carried alongside the money so a server-side caller can format it. Route
   * handlers never render the root layout, so `formatCurrency` has no `<html>`
   * to read the active locale from and silently falls back to rupees.
   */
  currency: string;
}

export class UnknownProductError extends Error {
  constructor(readonly slug: string) {
    super(`No such product: ${slug}`);
    this.name = "UnknownProductError";
  }
}

/**
 * The cart asked for a size this product does not sell.
 *
 * The same situation as an unknown slug — the cart and the shop disagree about
 * what is on offer — and it is refused the same way, rather than priced.
 */
export class UnknownWeightError extends Error {
  constructor(
    readonly slug: string,
    readonly weight: string,
  ) {
    super(`No such weight on ${slug}: ${weight}`);
    this.name = "UnknownWeightError";
  }
}

/** The unit price of one line, given the options the customer picked. */
function priceLine(product: LandingProduct, line: QuoteLineInput): number {
  const weightOptions = getProductWeightOptions(product);

  // An unrecognised weight label is REFUSED, not repriced.
  //
  // This was `Math.max(0, findIndex(...))`, so a label the product does not
  // have priced at index 0 — the smallest, cheapest tier — while the line kept
  // the label the customer sent. The order then read "2 kg" and charged for
  // 0.5 kg, and the bakery baked and delivered the 2 kg cake. The comment here
  // said this stopped a stale cart buying the largest cake at the smallest
  // price; it was the mechanism for doing exactly that.
  //
  // No label at all is different, and still fine: the customer did not choose a
  // size, so the default tier applies.
  let index = 0;
  if (line.weight) {
    index = weightOptions.findIndex((option) => option.label === line.weight);
    if (index < 0) throw new UnknownWeightError(product.slug, line.weight);
  }

  const chosen = weightOptions[index] ?? weightOptions[0];
  const weightPrice = product.weights?.[index]?.price ?? product.price + (chosen?.modifier ?? 0);

  return calculateProductUnitPrice({
    basePrice: product.price,
    weightPrice,
    variantGroups: getProductVariantGroups(product),
    variantSelections: line.variantSelections ?? {},
  });
}

export async function priceCart(input: QuoteInput): Promise<CartQuote> {
  const [settingsRaw, coupons, zones] = await Promise.all([
    getSettings(),
    Promise.resolve(getCoupons()),
    Promise.resolve(getZones()),
  ]);

  const settings = settingsRaw as unknown as Record<string, unknown>;
  const commerce = (settings.commerce ?? {}) as CommerceSettings;
  const currency = ((settings.general ?? {}) as GeneralSettings).currency;

  const items: QuotedLine[] = [];
  for (const line of input.items) {
    const quantity = Math.max(1, Math.floor(line.quantity));
    const product = (await productRepo.findBySlug(line.productSlug)) as LandingProduct | null;
    // Refused rather than priced at zero: an unknown slug means the cart and the
    // catalogue disagree, and guessing which is right is how a shop gives away
    // a cake it has deleted.
    if (!product) throw new UnknownProductError(line.productSlug);

    items.push({
      ...line,
      quantity,
      name: product.name,
      image: product.image,
      price: priceLine(product, line),
    });
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // The coupon is RESOLVED here, not accepted. It used to arrive as
  // `z.record(z.string(), z.unknown())` — an object the caller invented, whose
  // discount bore no relation to anything, and which then appeared in the
  // admin's coupon performance report as if it were real.
  const applied = input.couponCode
    ? resolveCouponDiscount(await Promise.resolve(coupons), input.couponCode, subtotal)
    : null;

  const totals = calculateCartTotals({
    items: items as never,
    discount: applied?.discountAmount ?? 0,
    giftWrap: Boolean(input.giftWrap),
    deliveryAddress: input.deliveryAddress,
    commerceOverride: commerce,
    zonesOverride: (await Promise.resolve(zones)) as DeliveryZone[],
    // Tax rounds to the shop's minor unit. On the server there is no `<html>`
    // for the formatter to read a locale from, so this has to be passed.
    currencyOverride: currency,
  });

  return {
    items,
    totals,
    coupon: applied,
    rejectedCoupon: input.couponCode && !applied ? input.couponCode : undefined,
    commerce,
    currency,
  };
}
