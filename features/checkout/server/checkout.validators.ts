import { z } from "zod";

/**
 * What a caller may say about a cart.
 *
 * Note what is absent: `price`, and any `totals` at all. Those used to arrive
 * from the browser and be stored verbatim, which is how a 5000-rupee cake could
 * be ordered — and genuinely paid for — at 1 rupee. The caller says WHAT they
 * chose; the shop says what it costs.
 */
export const quoteLineSchema = z.object({
  productSlug: z.string().trim().min(1, "Item is missing a product reference"),
  quantity: z.number().int().min(1).max(99),
  weight: z.string().trim().optional(),
  flavour: z.string().trim().optional(),
  shape: z.string().trim().optional(),
  message: z.string().trim().max(500).optional(),
  // A URL this server minted, so it is length-bounded and never rendered as HTML.
  photoUrl: z.string().trim().max(500).optional(),
  deliveryDate: z.string().trim().optional(),
  deliveryTime: z.string().trim().optional(),
  variantSelections: z.record(z.string(), z.string()).optional(),
});

export const quoteSchema = z.object({
  items: z.array(quoteLineSchema).min(1, "Cannot price an empty cart").max(50),
  // A CODE, not a coupon object. The order used to carry
  // `z.record(z.string(), z.unknown())` — a discount the caller invented, which
  // then appeared in the admin's coupon performance report as if it were real.
  couponCode: z.string().trim().max(40).optional(),
  giftWrap: z.boolean().optional(),
  deliveryAddress: z
    .object({ city: z.string().trim().optional(), pincode: z.string().trim().optional() })
    .optional(),

  /**
   * The rest of the order intent, so the draft is enough to build an order from
   * WITHOUT the browser.
   *
   * That is what lets the webhook finish a payment whose customer closed the tab
   * before the confirmation came back: the money arrives, Razorpay tells the
   * server, and the server already holds everything it needs. Optional, because
   * a quote asked purely to show a running total has no address yet.
   */
  address: z
    .object({
      fullName: z.string().trim().min(1),
      email: z.string().trim().pipe(z.email()),
      phone: z.string().trim().min(1),
      addressLine1: z.string().trim().min(1),
      addressLine2: z.string().trim().optional(),
      city: z.string().trim().min(1),
      state: z.string().trim().min(1),
      pincode: z.string().trim().min(1),
    })
    .optional(),
  /**
   * Same shape as placement, so the quote refuses an impossible date where it
   * is still free rather than letting it through to be refused (or, as it was,
   * accepted) after the gateway has captured. `.partial()` stays: the quote runs
   * before the customer has necessarily chosen a slot.
   */
  deliverySlot: z
    .object({
      date: z
        .string()
        .trim()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Delivery date must be a calendar date (YYYY-MM-DD)")
        .refine((value) => {
          const [year, month, day] = value.split("-").map(Number);
          const stamp = new Date(Date.UTC(year, month - 1, day));
          return (
            stamp.getUTCFullYear() === year &&
            stamp.getUTCMonth() === month - 1 &&
            stamp.getUTCDate() === day
          );
        }, "That is not a real date"),
      timeSlot: z.string().trim().max(60),
    })
    .partial()
    .optional(),
  orderNotes: z.string().trim().max(1000).optional(),
});

export type QuoteRequest = z.infer<typeof quoteSchema>;
