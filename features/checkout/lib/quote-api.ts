import type { CartLineItem } from "@/features/cart/lib/cart";
import type { CartTotals } from "@/features/orders/lib/cart-totals";
import type {
  CheckoutAddress,
  OrderPersonalisation,
} from "@/features/orders/lib/checkout-draft";

/**
 * Asks the SERVER what this cart costs.
 *
 * The browser used to decide. `items[].price` and the whole `totals` object were
 * sent with the order and stored verbatim, and the amount Razorpay was asked to
 * charge came from the same place — so a 5000-rupee cart could be ordered, and
 * genuinely paid for, at 1 rupee.
 *
 * The client still says WHAT was chosen: the slug, the quantity, the weight
 * label, the variant selections. It no longer says what those choices cost. The
 * `draftId` that comes back is what the payment is opened against, so the amount
 * charged is a number the shop computed before the gateway was involved.
 */
export interface CartQuoteResponse {
  draftId: string;
  items: (CartLineItem & { price: number })[];
  totals: CartTotals;
  coupon: { code: string; label: string; discountAmount: number } | null;
  /** A code the shop does not honour, so the customer can be told. */
  rejectedCoupon?: string;
}

export interface QuoteRequest {
  items: CartLineItem[];
  couponCode?: string;
  giftWrap?: boolean;
  deliveryAddress?: { city?: string; pincode?: string };
  /**
   * The rest of the order intent. Sent so the SERVER can finish this order from
   * the draft alone if the browser never comes back — a payment that completes
   * after the tab closes used to leave money with no order behind it.
   */
  /**
   * The type itself, not a copy of its fields.
   *
   * This was an inline duplicate of `CheckoutAddress`, which meant a field
   * added to the address had two more places to be forgotten — here, and in
   * the server schema this posts to. One of them is now impossible to miss.
   */
  address?: CheckoutAddress;
  deliverySlot?: { date?: string; timeSlot?: string };
  orderNotes?: string;
  /** Sent so the webhook can finish this order without the browser. */
  personalisation?: OrderPersonalisation;
}

export interface QuoteOutcome {
  quote: CartQuoteResponse | null;
  /** A message worth showing the customer — closed shop, item gone, offline. */
  error?: string;
}

export async function requestCartQuote(input: QuoteRequest): Promise<QuoteOutcome> {
  // Only what the customer chose travels. Prices deliberately do not.
  const items = input.items.map((item) => ({
    productSlug: item.productSlug,
    quantity: item.quantity,
    weight: item.weight,
    flavour: item.flavour,
    shape: item.shape,
    message: item.message,
    photoUrl: item.photoUrl,
    deliveryDate: item.deliveryDate,
    deliveryTime: item.deliveryTime,
    variantSelections: item.variantSelections,
  }));

  try {
    const res = await fetch("/api/checkout/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items,
        couponCode: input.couponCode,
        giftWrap: input.giftWrap,
        deliveryAddress: input.deliveryAddress,
        address: input.address,
        deliverySlot: input.deliverySlot,
        orderNotes: input.orderNotes,
        personalisation: input.personalisation,
      }),
    });

    const body = (await res.json().catch(() => null)) as
      | { success?: boolean; data?: CartQuoteResponse; message?: string }
      | null;

    if (!res.ok || !body?.success || !body.data) {
      return { quote: null, error: body?.message ?? "Could not price your cart." };
    }
    return { quote: body.data };
  } catch {
    return { quote: null, error: "Could not reach the store. Check your connection." };
  }
}
