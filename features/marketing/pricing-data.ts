/**
 * The plans, and what is in them.
 *
 * ── HOW TO PUT REAL PRICES IN ──────────────────────────────────────────────
 * Every tier below has `price: null`, which renders "Talk to us" and points the
 * button at the contact page. To publish an actual figure, set:
 *
 *     price: { amount: "₹2,999", period: "per month" }
 *
 * and the card shows that instead. Nothing else needs changing. Leave a tier at
 * `null` and it keeps asking people to get in touch — mixing the two is fine,
 * which is the usual shape when the top tier is negotiated and the others are not.
 *
 * Deliberately empty to begin with: a price is a commitment, and a wrong one is
 * far harder to withdraw than a missing one. It is also the only thing on this
 * page that cannot be derived from what the software actually does.
 */

export interface PricingTier {
  name: string;
  /** One line: who this is for. */
  audience: string;
  price: { amount: string; period: string } | null;
  /** Drawn larger, with the accent border. Exactly one tier should set it. */
  featured?: boolean;
  /** What this tier includes. Every line here is a real capability of the app. */
  includes: string[];
  /** Shown greyed with a line through — honest about what this tier does NOT do. */
  excludes?: string[];
}

export const pricingTiers: PricingTier[] = [
  {
    name: "Starter",
    audience: "A single shop taking its first orders online.",
    price: null,
    includes: [
      "Customer-facing storefront with your own branding",
      "Product catalogue with categories, flavours and weights",
      "Cart, checkout and order tracking",
      "Cash on delivery and online payment via Razorpay",
      "Order management dashboard",
      "Customer accounts and order history",
      "Email confirmations and invoices",
      "Homepage builder — arrange sections without code",
    ],
    excludes: ["Wedding enquiry pages", "Photo cakes", "Advanced reports"],
  },
  {
    name: "Growth",
    audience: "A shop that has outgrown a spreadsheet.",
    price: null,
    featured: true,
    includes: [
      "Everything in Starter",
      "Wedding cake pages with their own builder and enquiry form",
      "Photo cakes — customers upload their own image",
      "Inventory tracking with low-stock alerts",
      "Coupons, offers and delivery zones",
      "Reviews with moderation",
      "Reports — revenue, top products, customers, payment mix",
      "WhatsApp and email templates",
      "Media library with folders",
    ],
  },
  {
    name: "Enterprise",
    audience: "More than one outlet, or a shop with its own rules.",
    price: null,
    includes: [
      "Everything in Growth",
      "White-label — run it as a cake shop, bakery, café or custom retail",
      "Your own domain and mail sender",
      "Role-based access for staff",
      "Audit trail of every admin action",
      "Security centre with active device management",
      "Backup and restore",
      "Priority support",
    ],
  },
];

/**
 * Answers to what people actually ask before buying. Kept factual — every one
 * of these is checkable against the running software rather than a promise.
 */
export const pricingFaqs: { question: string; answer: string }[] = [
  {
    question: "What do I need before I can take a payment?",
    answer:
      "A Razorpay account for card, UPI and netbanking, and a Cloudinary account so you can upload your own photos. Both have free tiers. Cash on delivery works without either.",
  },
  {
    question: "Can I use my own domain?",
    answer:
      "Yes. The storefront, the admin panel and the emails all run on whatever domain you point at it.",
  },
  {
    question: "Is my data mine?",
    answer:
      "Yes. Orders, customers and products live in your own MongoDB database. There is a backup and restore screen in Settings, and nothing is locked to us.",
  },
  {
    question: "Does it work on a phone?",
    answer:
      "Both sides do. Customers order from a phone, and the admin panel — orders, stock, the builders — is built for one too.",
  },
  {
    question: "Can I sell something other than cakes?",
    answer:
      "Yes. The wording throughout adapts to the business type you pick — bakery, cake shop, café or custom retail — and the modules you do not sell can be switched off.",
  },
  {
    question: "What happens to an order if a customer's payment fails halfway?",
    answer:
      "The payment webhook catches it. A payment taken with no order attached is flagged in the admin as an unclaimed payment so it can be refunded or matched, rather than quietly lost.",
  },
];
