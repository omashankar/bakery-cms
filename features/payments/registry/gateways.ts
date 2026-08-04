/**
 * Payment gateway catalogue.
 *
 * Each entry is a static record. Runtime state (enabled / priority) lives in
 * payment-gateway-settings.ts; secrets live server-side in
 * gateway-credentials.server.ts.
 *
 * IMPORTANT — most of this catalogue does not work yet. Only the entries marked
 * `isCore` can actually take money: the checkout renders exactly two methods
 * (`razorpay` and `cod`, see registry/methods.ts), and only Razorpay has a
 * server-side payment path. Everything else is a catalogue record waiting for an
 * implementation.
 *
 * That distinction has to be VISIBLE in the admin, which it was not: every card
 * had a working-looking enable switch, a credentials form and a "live at
 * checkout" counter, so enabling Stripe and pasting a live secret key looked
 * exactly like connecting a payment method — and changed nothing a customer
 * would ever see. Use `isGatewayWired` at every point where the UI implies a
 * gateway can charge someone.
 *
 * ---
 * TO ACTUALLY SWITCH ONE ON, e.g. Stripe:
 *
 *   1. Build the server payment path — the real work. Follow Razorpay's shape:
 *        features/payments/server/razorpay-payment.server.ts   (is it captured?)
 *        features/payments/server/razorpay-refund.server.ts    (send money back)
 *        app/api/razorpay/order|verify|webhook/route.ts
 *      The rules those enforce are not Razorpay-specific and must hold for any
 *      gateway: charge only what a server-side CheckoutDraft priced, verify the
 *      capture against that draft before the order is `paid`, and record a
 *      captured payment that could not become an order rather than dropping it.
 *
 *   2. Add its method to `registry/methods.ts` so the checkout can render it,
 *      and to `PaymentMethodSettings` so it can be enabled.
 *
 *   3. Flip `isCore: true` here.
 *
 * Step 3 is what moves the card out of "Not available yet", enables its switch,
 * lets its credentials be saved, and counts it in "live at checkout". The admin
 * UI needs NO changes: the credentials form is generated from `configFields`
 * (see apps/admin/commerce/components/gateway-credentials-form.tsx) and the
 * secrets go to the shared server-side store.
 *
 * Razorpay has its own form only because it carries three things nothing else
 * does — environment-variable override, a webhook secret, and a live connection
 * check. A new gateway needing those should generalise them, not copy them.
 */

export type GatewayCategory = "online" | "offline";

export interface GatewayField {
  key: string;
  label: string;
  type: "text" | "password";
  placeholder?: string;
  required?: boolean;
  helper?: string;
}

export interface PaymentGatewayConfig {
  id: string;
  name: string;
  /** 1–2 letter monogram for the logo tile. */
  mark: string;
  category: GatewayCategory;
  description: string;
  supportedMethodIds: string[];
  supportedCurrencies: string[];
  supportedCountries: string[];
  processingTime: string;
  configFields: GatewayField[];
  docsUrl?: string;
  /**
   * This gateway is connected to a real payment path and can take money.
   *
   * True for Razorpay (full server-side integration) and COD (cash, no gateway).
   * False for everything else — those are catalogue entries only.
   */
  isCore?: boolean;
  /** Ordering in the admin's own gateway list. NOT the checkout order. */
  defaultPriority: number;
}

const KEY = (extra: GatewayField[] = []): GatewayField[] => [
  { key: "keyId", label: "Key / Merchant ID", type: "text", placeholder: "Enter key id", required: true },
  { key: "keySecret", label: "Secret Key", type: "password", placeholder: "Enter secret key", required: true },
  ...extra,
];

export const PAYMENT_GATEWAYS: PaymentGatewayConfig[] = [
  {
    id: "razorpay",
    name: "Razorpay",
    mark: "R",
    category: "online",
    description: "Unified UPI, Cards, Netbanking, Wallets & EMI for India.",
    supportedMethodIds: ["upi", "card", "netbanking", "wallet", "emi"],
    supportedCurrencies: ["INR"],
    supportedCountries: ["IN"],
    processingTime: "Instant",
    configFields: KEY([
      { key: "webhookSecret", label: "Webhook Secret", type: "password", placeholder: "Optional" },
    ]),
    docsUrl: "https://dashboard.razorpay.com",
    isCore: true,
    defaultPriority: 1,
  },
  {
    id: "cod",
    name: "Cash on Delivery",
    mark: "₹",
    category: "offline",
    description: "Customer pays in cash when the order is delivered.",
    supportedMethodIds: ["cod"],
    supportedCurrencies: ["INR"],
    supportedCountries: ["IN"],
    processingTime: "On delivery",
    // No fields. It carried `maxOrderValue` and `instructions`, which looked
    // like COD settings and were neither: nothing in the checkout, the order
    // service or the storefront ever read them. So the screen offered a "Max
    // order value (₹)" box, saved it into the gateway CREDENTIALS store, and
    // reported success — while orders above that value went through exactly as
    // before and the customer was never shown the instructions.
    //
    // If COD ever needs a cap, it belongs in commerce settings next to the other
    // order rules and must be enforced at checkout, not stored beside API keys.
    configFields: [],
    isCore: true,
    defaultPriority: 2,
  },
  {
    id: "stripe",
    name: "Stripe",
    mark: "S",
    category: "online",
    description: "Global cards, wallets & bank debits with strong fraud tooling.",
    supportedMethodIds: ["card", "wallet"],
    supportedCurrencies: ["USD", "EUR", "GBP", "INR", "AUD"],
    supportedCountries: ["US", "GB", "EU", "IN", "AU"],
    processingTime: "Instant",
    configFields: [
      { key: "publishableKey", label: "Publishable Key", type: "text", placeholder: "pk_test_…", required: true },
      { key: "secretKey", label: "Secret Key", type: "password", placeholder: "sk_test_…", required: true },
      { key: "webhookSecret", label: "Webhook Secret", type: "password", placeholder: "whsec_…" },
    ],
    docsUrl: "https://dashboard.stripe.com",
    defaultPriority: 3,
  },
  {
    id: "paypal",
    name: "PayPal",
    mark: "PP",
    category: "online",
    description: "Worldwide PayPal balance, cards & Pay Later.",
    supportedMethodIds: ["wallet", "card"],
    supportedCurrencies: ["USD", "EUR", "GBP", "AUD"],
    supportedCountries: ["US", "GB", "EU", "AU"],
    processingTime: "Instant",
    configFields: [
      { key: "clientId", label: "Client ID", type: "text", placeholder: "Client ID", required: true },
      { key: "clientSecret", label: "Client Secret", type: "password", placeholder: "Client Secret", required: true },
    ],
    docsUrl: "https://developer.paypal.com",
    defaultPriority: 4,
  },
  {
    id: "cashfree",
    name: "Cashfree",
    mark: "CF",
    category: "online",
    description: "India UPI, Cards, Netbanking & payouts.",
    supportedMethodIds: ["upi", "card", "netbanking", "wallet"],
    supportedCurrencies: ["INR"],
    supportedCountries: ["IN"],
    processingTime: "Instant",
    configFields: KEY(),
    docsUrl: "https://merchant.cashfree.com",
    defaultPriority: 5,
  },
  {
    id: "phonepe",
    name: "PhonePe",
    mark: "Pe",
    category: "online",
    description: "PhonePe UPI switch & payment gateway for India.",
    supportedMethodIds: ["upi", "wallet", "card"],
    supportedCurrencies: ["INR"],
    supportedCountries: ["IN"],
    processingTime: "Instant",
    configFields: [
      { key: "merchantId", label: "Merchant ID", type: "text", placeholder: "Merchant ID", required: true },
      { key: "saltKey", label: "Salt Key", type: "password", placeholder: "Salt Key", required: true },
      { key: "saltIndex", label: "Salt Index", type: "text", placeholder: "1" },
    ],
    docsUrl: "https://business.phonepe.com",
    defaultPriority: 6,
  },
  {
    id: "payu",
    name: "PayU",
    mark: "Pu",
    category: "online",
    description: "Cards, UPI, EMI & Netbanking across India.",
    supportedMethodIds: ["upi", "card", "netbanking", "emi"],
    supportedCurrencies: ["INR"],
    supportedCountries: ["IN"],
    processingTime: "Instant",
    configFields: [
      { key: "merchantKey", label: "Merchant Key", type: "text", placeholder: "Merchant Key", required: true },
      { key: "merchantSalt", label: "Merchant Salt", type: "password", placeholder: "Merchant Salt", required: true },
    ],
    docsUrl: "https://onboarding.payu.in",
    defaultPriority: 7,
  },
  {
    id: "ccavenue",
    name: "CCAvenue",
    mark: "CC",
    category: "online",
    description: "Long-standing Indian gateway with 200+ options.",
    supportedMethodIds: ["card", "netbanking", "upi", "wallet", "emi"],
    supportedCurrencies: ["INR", "USD"],
    supportedCountries: ["IN"],
    processingTime: "Instant",
    configFields: [
      { key: "merchantId", label: "Merchant ID", type: "text", placeholder: "Merchant ID", required: true },
      { key: "accessCode", label: "Access Code", type: "text", placeholder: "Access Code", required: true },
      { key: "workingKey", label: "Working Key", type: "password", placeholder: "Working Key", required: true },
    ],
    docsUrl: "https://www.ccavenue.com",
    defaultPriority: 8,
  },
  {
    id: "square",
    name: "Square",
    mark: "Sq",
    category: "online",
    description: "Cards & digital wallets for US, UK, AU, CA.",
    supportedMethodIds: ["card", "wallet"],
    supportedCurrencies: ["USD", "GBP", "AUD", "CAD"],
    supportedCountries: ["US", "GB", "AU", "CA"],
    processingTime: "Instant",
    configFields: [
      { key: "applicationId", label: "Application ID", type: "text", placeholder: "Application ID", required: true },
      { key: "accessToken", label: "Access Token", type: "password", placeholder: "Access Token", required: true },
      { key: "locationId", label: "Location ID", type: "text", placeholder: "Location ID" },
    ],
    docsUrl: "https://developer.squareup.com",
    defaultPriority: 9,
  },
  {
    id: "authorizenet",
    name: "Authorize.Net",
    mark: "AN",
    category: "online",
    description: "Established US card gateway (Visa Solutions).",
    supportedMethodIds: ["card"],
    supportedCurrencies: ["USD", "CAD", "GBP"],
    supportedCountries: ["US", "CA", "GB"],
    processingTime: "Instant",
    configFields: [
      { key: "apiLoginId", label: "API Login ID", type: "text", placeholder: "API Login ID", required: true },
      { key: "transactionKey", label: "Transaction Key", type: "password", placeholder: "Transaction Key", required: true },
    ],
    docsUrl: "https://developer.authorize.net",
    defaultPriority: 10,
  },
  {
    id: "manual_transfer",
    name: "Manual Bank Transfer",
    mark: "BT",
    category: "offline",
    description: "Customer transfers to your bank; you verify & confirm.",
    supportedMethodIds: ["bank_transfer"],
    supportedCurrencies: ["INR"],
    supportedCountries: ["IN"],
    processingTime: "1–2 business days",
    configFields: [
      { key: "accountName", label: "Account Name", type: "text", placeholder: "Business name" },
      { key: "accountNumber", label: "Account Number", type: "text", placeholder: "Account number" },
      { key: "ifsc", label: "IFSC Code", type: "text", placeholder: "IFSC" },
      { key: "upiId", label: "UPI ID", type: "text", placeholder: "business@upi" },
    ],
    defaultPriority: 11,
  },
  {
    id: "store_pickup",
    name: "Store Pickup Payment",
    mark: "SP",
    category: "offline",
    description: "Customer pays at the store during pickup.",
    supportedMethodIds: ["store_pickup"],
    supportedCurrencies: ["INR"],
    supportedCountries: ["IN"],
    processingTime: "At pickup",
    configFields: [
      { key: "storeAddress", label: "Pickup Address", type: "text", placeholder: "Store address" },
      { key: "pickupHours", label: "Pickup Hours", type: "text", placeholder: "10 AM – 8 PM" },
    ],
    defaultPriority: 12,
  },
];

export function getGatewayConfig(id: string): PaymentGatewayConfig | undefined {
  return PAYMENT_GATEWAYS.find((gateway) => gateway.id === id);
}

/**
 * Can this gateway actually charge a customer today?
 *
 * The one question every admin control here depends on. A switch, a credentials
 * form or a "live at checkout" count that ignores it is telling the operator
 * something untrue about their own shop.
 */
export function isGatewayWired(id: string): boolean {
  return getGatewayConfig(id)?.isCore === true;
}

/** The gateways that can take money, and the ones that are catalogue only. */
export function splitGatewaysByReadiness() {
  return {
    wired: PAYMENT_GATEWAYS.filter((gateway) => gateway.isCore === true),
    notYet: PAYMENT_GATEWAYS.filter((gateway) => gateway.isCore !== true),
  };
}
