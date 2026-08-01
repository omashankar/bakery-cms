/**
 * The shop's minimum order value, as a rule rather than as a message.
 *
 * `minOrderValue` is configured on two admin screens and was checked in exactly
 * one place: `checkout-page.tsx`, in the browser, as a disabled Pay button and a
 * toast. Neither the quote nor the placement endpoint had ever heard of it, so a
 * direct POST — or the storefront with one line edited in devtools — placed
 * orders below the minimum all day, and the shop only found out when it had to
 * bake and deliver a ₹40 order it had decided was not worth the trip.
 *
 * Pure and shared so the quote, the placement and the browser all answer the
 * same question the same way. The threshold applies to the SUBTOTAL — the goods
 * — not to the total: adding a delivery fee and tax to clear a minimum that
 * exists to make the trip worthwhile would defeat the point of it.
 */
export interface MinimumOrderCheck {
  /** True when the shop should refuse this cart. */
  below: boolean;
  /** How much more the customer needs to add. Zero when `below` is false. */
  shortfall: number;
}

export function checkMinimumOrder(subtotal: number, minOrderValue: number): MinimumOrderCheck {
  // A zero, negative or unset minimum means the shop does not enforce one; the
  // admin field documents 0 as exactly that.
  if (!Number.isFinite(minOrderValue) || minOrderValue <= 0) {
    return { below: false, shortfall: 0 };
  }
  const goods = Number.isFinite(subtotal) ? subtotal : 0;
  return goods < minOrderValue
    ? { below: true, shortfall: minOrderValue - goods }
    : { below: false, shortfall: 0 };
}
