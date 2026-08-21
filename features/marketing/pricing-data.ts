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
