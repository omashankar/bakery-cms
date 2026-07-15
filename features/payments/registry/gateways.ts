/**
 * Payment gateway registry (config-driven, frontend only).
 *
 * Each entry is a static catalogue record. Runtime state (enabled / test-live /
 * priority / credentials) lives in payment-gateway-settings.ts. Adding a gateway =
 * adding an entry here + wiring its methods later — no UI changes needed.
 *
 * `configFields` are PLACEHOLDERS for the future backend. Nothing here performs a
 * real connection. Razorpay + COD are marked `isCore` and keep their existing,
 * already-working behaviour.
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
  /** Razorpay + COD — existing, real behaviour. Not a placeholder. */
  isCore?: boolean;
  /** Default order in checkout / manager. */
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
    configFields: [
      { key: "maxOrderValue", label: "Max order value (₹)", type: "text", placeholder: "e.g. 5000" },
      { key: "instructions", label: "Customer instructions", type: "text", placeholder: "Keep exact change ready" },
    ],
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
