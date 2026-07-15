/**
 * Payment method registry (config-driven).
 *
 * Adding a new customer-facing method = adding an entry here. The checkout reads
 * only the ENABLED ones (via resolve-methods.ts) so admins control visibility from
 * settings. Existing COD + Razorpay are the first two entries — nothing removed.
 *
 * Phase 3 covers the checkout-facing shape. The full multi-gateway registry
 * (Stripe, PayPal, Cashfree, …) expands in Phase 4 (Gateway Manager).
 */

export type PaymentMethodGroup = "online" | "digital" | "cards" | "banking" | "offline";

export interface CheckoutMethod {
  /** Matches the order's paymentMethod value. */
  id: string;
  name: string;
  description: string;
  group: PaymentMethodGroup;
  /** lucide icon name (rendered by the card). */
  iconKey: "CreditCard" | "Banknote" | "Smartphone" | "Wallet" | "Building2";
  /** The gateway that processes it — null for offline methods. */
  gatewayId: string | null;
  processingTime: string;
  recommended?: boolean;
  /** Brand chips shown on the card (UPI, Visa, …). */
  brands?: string[];
  /** Expandable detail bullets. */
  details?: string[];
  /** Lower = shown first. */
  priority: number;
}

/**
 * Every method the storefront can render. Enablement lives in commerce settings
 * (`paymentMethods`), so this array is the static catalogue only.
 */
export const CHECKOUT_METHODS: CheckoutMethod[] = [
  {
    id: "razorpay",
    name: "Pay Online",
    description: "UPI, Cards, Netbanking & Wallets — secured by Razorpay",
    group: "online",
    iconKey: "CreditCard",
    gatewayId: "razorpay",
    processingTime: "Instant confirmation",
    recommended: true,
    brands: ["UPI", "Visa", "Mastercard", "RuPay", "Netbanking", "Wallets"],
    details: [
      "Pay with any UPI app, debit/credit card, netbanking or wallet",
      "Bank-grade encryption — your card details are never stored",
      "Order is confirmed the moment payment succeeds",
    ],
    priority: 1,
  },
  {
    id: "cod",
    name: "Cash on Delivery",
    description: "Pay in cash when your order arrives",
    group: "offline",
    iconKey: "Banknote",
    gatewayId: null,
    processingTime: "Pay on delivery",
    details: [
      "Keep the exact amount ready for a contactless handover",
      "Available for eligible pincodes and order values",
    ],
    priority: 2,
  },
];
