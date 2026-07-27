import { z } from "zod";

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
  orderNumber: z.string().optional(),
  placedAt: z.string().optional(),
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
  statusHistory: z.array(z.object({ status: z.string(), at: z.string() }).passthrough()).optional(),
  estimatedDelivery: z.string().optional(),
  items: z.array(cartItemSchema).min(1, "Cannot place an empty order"),
  totals: totalsSchema,
  address: addressSchema,
  paymentMethod: z.enum(["cod", "upi", "card", "razorpay"]),
  paymentStatus: z.enum(["cod", "paid", "pending", "failed", "refunded"]).optional(),
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

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
export type RefundInput = z.infer<typeof refundSchema>;
