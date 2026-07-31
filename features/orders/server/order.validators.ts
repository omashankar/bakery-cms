import { z } from "zod";
import { DEFAULT_TIME_ZONE, isValidTimeZone } from "@/features/orders/lib/viewer-time";

/**
 * Zod contracts for order operations. Nested value objects (items, totals,
 * address, coupon) validate their commerce-critical fields and pass the rest
 * through, so the storefront's full payload is accepted without over-specifying.
 */

const cartItemSchema = z
  .object({
    productSlug: z.string().min(1, "Item is missing a product reference"),
    name: z.string(),
    price: z.number().min(0),
    quantity: z.number().int().min(1),
  })
  .passthrough();

const totalsSchema = z
  .object({
    subtotal: z.number(),
    total: z.number().min(0),
    itemCount: z.number(),
  })
  .passthrough();

const addressSchema = z
  .object({
    fullName: z.string().trim().min(1, "Name is required"),
    email: z.string().trim().pipe(z.email("Invalid email")),
    phone: z.string().trim().min(1, "Phone is required"),
    addressLine1: z.string().trim().min(1, "Address is required"),
    addressLine2: z.string().optional(),
    city: z.string().trim().min(1, "City is required"),
    state: z.string().trim().min(1, "State is required"),
    pincode: z.string().trim().min(1, "Pincode is required"),
  })
  .passthrough();

const deliverySlotSchema = z
  .object({ date: z.string(), timeSlot: z.string() })
  .passthrough();

export const placeOrderSchema = z.object({
  // Identity/state are OPTIONAL: when the storefront client places an order it
  // sends the id/orderNumber it already generated (so local + server agree);
  // a direct/headless API call omits them and the server generates them.
  id: z.string().optional(),
  // NOT accepted from the caller, and deliberately absent from this schema:
  // `orderNumber`, `placedAt`, `status`, `statusHistory`, `estimatedDelivery`,
  // `paymentStatus`. Every one of them used to be stored verbatim, and this
  // endpoint is anonymous — so a single POST could file an order that was
  // already `delivered`, or already `refunded`, backdated to any date, with a
  // fabricated history no lifecycle transition could have produced. The payment
  // ledger has no separate existence (transactions are derived from orders), so
  // those forgeries landed straight in the Transaction and Refund centres.
  //
  // `id` stays: it is the idempotency key the retry path re-sends byte for byte,
  // and a uuid is not enumerable. The client may keep sending the rest — `.strip()`
  // is Zod's default, so they are dropped rather than rejected, and no storefront
  // change is needed.
  items: z.array(cartItemSchema).min(1, "Cannot place an empty order"),
  totals: totalsSchema,
  address: addressSchema,
  paymentMethod: z.enum(["cod", "upi", "card", "razorpay"]),
  // `paymentReference` is still accepted — it is the gateway's payment id, and
  // the server now VERIFIES it against the gateway rather than taking the
  // client's word for what it means. `paymentStatus` is derived from that check.
  paymentReference: z.string().optional(),
  coupon: z.record(z.string(), z.unknown()).optional(),
  orderNotes: z.string().optional(),
  deliverySlot: deliverySlotSchema.optional(),
});

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "refunded",
] as const;

export const statusSchema = z.object({ status: z.enum(ORDER_STATUSES) });

export const cancelSchema = z.object({ cancellationReason: z.string().optional() });

export const refundSchema = z.object({
  reason: z.string().optional(),
  reasonDetail: z.string().optional(),
  notes: z.string().optional(),
  amount: z.number().min(0).optional(),
});

export const paymentSchema = z.object({
  paymentStatus: z.enum(["cod", "paid", "pending", "failed", "refunded"]),
  paymentReference: z.string().optional(),
});

export const notesSchema = z.object({ adminNotes: z.string() });

export const refundNotesSchema = z.object({ notes: z.string() });

export const refundRequestSchema = z.object({
  reason: z.string().optional(),
  reasonDetail: z.string().optional(),
  notes: z.string().optional(),
  amount: z.number().min(0).optional(),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
export type RefundInput = z.infer<typeof refundSchema>;
export type RefundNotesInput = z.infer<typeof refundNotesSchema>;
export type RefundRequestInput = z.infer<typeof refundRequestSchema>;

/**
 * Query params for the admin order list. Strings coerce from the URL; every
 * filter is optional so a bare `GET /api/orders` keeps its previous meaning.
 */
export const orderQuerySchema = z.object({
  status: z
    .enum([
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "out_for_delivery",
      "delivered",
      "cancelled",
      "refunded",
    ])
    .optional(),
  paymentStatus: z.enum(["cod", "paid", "pending", "failed", "refunded"]).optional(),
  deliveryStatus: z.enum(["pending", "in_progress", "in_transit", "delivered"]).optional(),
  dateRange: z.enum(["7d", "30d", "90d"]).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  amountMin: z.coerce.number().min(0).optional(),
  amountMax: z.coerce.number().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
  // 500 keeps the default response identical to the pre-pagination endpoint,
  // which the client-side cache hydration still relies on.
  limit: z.coerce.number().int().min(1).max(500).default(500),
});

export type OrderQueryInput = z.infer<typeof orderQuerySchema>;

/** Query params for the order analytics endpoint (reports + dashboard). */
export const orderAnalyticsQuerySchema = z.object({
  range: z.enum(["7d", "30d", "90d", "12m", "all"]).default("30d"),
  // An IANA zone, not an offset: an offset is one instant's worth of
  // information, and a DST zone has two. Unknown zones fall back to UTC
  // rather than 500-ing a report.
  timeZone: z
    .string()
    .trim()
    .max(64)
    .default(DEFAULT_TIME_ZONE)
    .transform((zone) => (isValidTimeZone(zone) ? zone : DEFAULT_TIME_ZONE)),
});

export type OrderAnalyticsQueryInput = z.infer<typeof orderAnalyticsQuerySchema>;

/** Page size shared by the commerce list endpoints. 500 bounds a CSV export. */
const listPaging = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(10),
};

const commerceDateRange = z.enum(["all", "7d", "30d", "90d"]).default("all");

export const refundCasesQuerySchema = z.object({
  search: z.string().trim().max(120).default(""),
  caseType: z.enum(["all", "cancelled", "refunded", "requested", "processing"]).default("all"),
  reason: z
    .enum([
      "all",
      "customer_request",
      "duplicate_order",
      "quality_issue",
      "delivery_failed",
      "payment_error",
      "order_cancelled",
      "other",
    ])
    .default("all"),
  dateRange: commerceDateRange,
  ...listPaging,
});

export const invoicesQuerySchema = z.object({
  search: z.string().trim().max(120).default(""),
  status: z
    .enum([
      "all",
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "out_for_delivery",
      "delivered",
      "cancelled",
      "refunded",
    ])
    .default("all"),
  payment: z.enum(["all", "cod", "paid", "pending", "failed", "refunded"]).default("all"),
  dateRange: commerceDateRange,
  ...listPaging,
});

export const transactionsQuerySchema = z.object({
  search: z.string().trim().max(120).default(""),
  gateway: z.string().trim().max(40).default("all"),
  method: z.string().trim().max(40).default("all"),
  statusGroup: z.enum(["all", "success", "pending", "failed", "refund", "cod"]).default("all"),
  dateRange: commerceDateRange,
  minAmount: z.string().trim().max(20).default(""),
  maxAmount: z.string().trim().max(20).default(""),
  ...listPaging,
});
