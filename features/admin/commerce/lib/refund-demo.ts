import type { PlacedOrder } from "@/features/storefront/checkout/lib/orders";
import { getOrders } from "@/features/storefront/checkout/lib/orders";
import { isRefundCase } from "./refund-utils";

function writeDemoOrders(orders: PlacedOrder[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("bakery-cms-orders", JSON.stringify(orders));
  window.dispatchEvent(new Event("bakery-orders-updated"));
}

export function ensureDemoRefundCases(): void {
  if (typeof window === "undefined") return;

  const orders = getOrders();
  if (orders.some(isRefundCase)) return;

  const base = new Date();
  base.setDate(base.getDate() - 2);

  const cancelledOrder: PlacedOrder = {
    id: crypto.randomUUID(),
    orderNumber: "BK-20260705-7720",
    items: [
      {
        id: "refund-demo-1",
        cakeSlug: "black-forest",
        name: "Black Forest Cake",
        image: "/images/cakes/black-forest.jpg",
        price: 1099,
        quantity: 1,
        weight: "1kg",
      },
    ],
    totals: {
      subtotal: 1099,
      delivery: 99,
      tax: 60,
      discount: 0,
      platformCharge: 0,
      giftWrapFee: 0,
      taxableAmount: 1099,
      total: 1258,
      itemCount: 1,
    },
    address: {
      fullName: "Ananya Patel",
      email: "ananya@demo.com",
      phone: "+91 99887 76655",
      addressLine1: "88 Residency Road",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560025",
    },
    paymentMethod: "card",
    paymentStatus: "paid",
    paymentReference: "CARD-DEMO-7720",
    placedAt: base.toISOString(),
    status: "cancelled",
    cancellationReason: "Customer changed delivery date — could not accommodate.",
    estimatedDelivery: new Date(base.getTime() + 86400000).toISOString(),
    statusHistory: [
      { status: "confirmed", at: base.toISOString() },
      {
        status: "cancelled",
        at: new Date(base.getTime() + 2 * 3600000).toISOString(),
      },
    ],
    refundRecord: {
      status: "requested",
      reason: "order_cancelled",
      amount: 1258,
      requestedAt: new Date(base.getTime() + 2 * 3600000).toISOString(),
      history: [
        {
          status: "requested",
          at: new Date(base.getTime() + 2 * 3600000).toISOString(),
          note: "Refund requested after cancellation",
        },
      ],
    },
  };

  const refundedAt = new Date(base.getTime() - 86400000);
  const refundedOrder: PlacedOrder = {
    id: crypto.randomUUID(),
    orderNumber: "BK-20260704-6615",
    items: [
      {
        id: "refund-demo-2",
        cakeSlug: "vanilla-birthday",
        name: "Vanilla Birthday Cake",
        image: "/images/cakes/vanilla-birthday.jpg",
        price: 749,
        quantity: 1,
        weight: "0.5kg",
        message: "Happy 5th Birthday!",
      },
    ],
    totals: {
      subtotal: 749,
      delivery: 0,
      tax: 37,
      discount: 0,
      platformCharge: 0,
      giftWrapFee: 49,
      taxableAmount: 749,
      total: 835,
      itemCount: 1,
    },
    address: {
      fullName: "Vikram Desai",
      email: "vikram@demo.com",
      phone: "+91 98123 45678",
      addressLine1: "15 Marine Drive",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400020",
    },
    paymentMethod: "upi",
    paymentStatus: "refunded",
    paymentReference: "UPI-DEMO-6615",
    placedAt: new Date(refundedAt.getTime() - 86400000).toISOString(),
    status: "refunded",
    refundReference: "REF-20260704-6615",
    estimatedDelivery: refundedAt.toISOString(),
    statusHistory: [
      {
        status: "confirmed",
        at: new Date(refundedAt.getTime() - 86400000).toISOString(),
      },
      {
        status: "preparing",
        at: new Date(refundedAt.getTime() - 82800000).toISOString(),
      },
      {
        status: "refunded",
        at: refundedAt.toISOString(),
      },
    ],
    refundRecord: {
      status: "completed",
      reason: "quality_issue",
      reasonDetail: "Cake decoration did not match approved design.",
      amount: 835,
      reference: "REF-20260704-6615",
      notes: "Full refund issued to original UPI payment method.",
      requestedAt: new Date(refundedAt.getTime() - 3600000).toISOString(),
      completedAt: refundedAt.toISOString(),
      history: [
        {
          status: "requested",
          at: new Date(refundedAt.getTime() - 3600000).toISOString(),
          note: "Customer reported quality issue with photo cake print.",
        },
        {
          status: "processing",
          at: new Date(refundedAt.getTime() - 1800000).toISOString(),
          note: "Refund initiated",
        },
        {
          status: "completed",
          at: refundedAt.toISOString(),
          note: "Full refund issued to original UPI payment method.",
        },
      ],
    },
  };

  writeDemoOrders([...orders, cancelledOrder, refundedOrder]);
}
