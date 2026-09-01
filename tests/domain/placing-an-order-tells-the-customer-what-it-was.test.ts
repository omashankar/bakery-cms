import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The other half of the confirmation email, and the one a source scan misses.
 *
 * A template body that says `{{order_items}}` only names the product if the
 * sender supplies that key. `renderTemplate` writes an unknown key back
 * VERBATIM — that is how the missing `invoice_url` was caught, per the comment
 * above the send site — so dropping the variable does not blank the line, it
 * mails the customer a literal `{{order_items}}`.
 *
 * Nothing pinned it. `order_items` could be deleted from the send in
 * order.service.ts and the whole suite stayed green, because the email tests
 * hand-write their own variable maps instead of reading what the sender passes.
 *
 * This runs the REAL `placeOrder` with only Mongo, the gateway and the mailer
 * stubbed, and asserts on the map the sender actually built.
 */

const CATALOGUE: Record<string, Record<string, unknown>> = {
  "type-c-charger": {
    name: "65W Type-C Charger",
    price: 1499,
    images: ["/charger.jpg"],
    categoryId: "cat-chargers",
    weights: [],
    variantGroups: [
      {
        id: "g-storage",
        name: "Storage",
        type: "custom",
        options: [
          { id: "o-128", label: "128 GB", priceAdjustment: 0, isDefault: true },
          { id: "o-256", label: "256 GB", priceAdjustment: 5000, isDefault: false },
        ],
      },
    ],
  },
};

const state = vi.hoisted(() => ({
  emails: [] as { slug: string; to: string; variables: Record<string, string> }[],
  /** Filled from `defaultCommerceSettings` below — the totals need real rates. */
  commerce: {} as Record<string, unknown>,
}));

vi.mock("@/features/communications/server/email.service", () => ({
  sendTemplatedEmail: async (
    slug: string,
    to: string,
    variables: Record<string, string>,
  ) => {
    state.emails.push({ slug, to, variables });
    return { sent: true };
  },
  publicBaseUrl: async () => "https://shop.example.test",
}));

vi.mock("@/features/payments/server/notification-prefs.server", () => ({
  isNotificationEnabled: async (_key: string, channel: string) => channel === "email",
}));

vi.mock("@/features/products/server/product.repository", () => ({
  findBySlug: async (slug: string) =>
    slug in CATALOGUE ? { slug, ...CATALOGUE[slug] } : null,
  listBySlugs: async () => [],
  patch: async () => null,
}));

vi.mock("@/features/settings/server/settings.service", () => ({
  getSettings: async () => ({
    commerce: state.commerce,
    general: { currency: "INR" },
    contact: { email: "shop@example.test" },
  }),
}));

vi.mock("@/features/commerce/server/commerce.service", () => ({
  getCoupons: async () => [],
  getZones: async () => [],
}));

vi.mock("@/features/commerce/server/commerce.repository", () => ({
  incrementCouponUsage: async () => undefined,
  decrementCouponUsage: async () => undefined,
}));

vi.mock("@/features/orders/server/order.repository", () => ({
  findByPaymentReference: async () => null,
  findById: async () => null,
  orderNumberExists: async () => false,
  createOrderWithStockReduction: async (order: Record<string, unknown>) => ({
    kind: "created",
    order,
  }),
  restoreStock: async () => undefined,
  patch: async () => null,
}));

vi.mock("@/lib/server/audit/audit-log", () => ({
  writeAuditLog: async () => undefined,
  requestContext: () => ({}),
}));

vi.mock("@/features/payments/server/unclaimed-payment.repository", () => ({
  resolveUnclaimedPayment: async () => undefined,
}));

vi.mock("@/features/checkout/server/draft.repository", () => ({
  findDraft: async () => null,
  claimDraft: async () => null,
}));

const { placeOrder } = await import("@/features/orders/server/order.service");
const { defaultCommerceSettings } = await import("@/features/settings/lib/settings-utils");

const address = {
  fullName: "Asha Menon",
  email: "asha@example.test",
  phone: "9000000000",
  addressLine1: "12 Bakery Lane",
  city: "Mumbai",
  state: "MH",
  pincode: "400001",
};

beforeEach(() => {
  state.emails = [];
  // No delivery fee and no tax, so the asserted total is the line price alone.
  state.commerce = {
    ...defaultCommerceSettings,
    deliveryFee: 0,
    freeDeliveryThreshold: 0,
    minOrderValue: 0,
    taxEnabled: false,
    platformChargeEnabled: false,
  };
});

async function placeCharger() {
  await placeOrder(
    {
      items: [
        {
          productSlug: "type-c-charger",
          name: "65W Type-C Charger",
          price: 1,
          quantity: 1,
          variantSelections: { "g-storage": "o-256" },
        },
      ],
      totals: { subtotal: 1, total: 1, itemCount: 1 },
      address,
      paymentMethod: "cod",
    } as never,
    { ip: "1.1.1.1", userAgent: "test" } as never,
  );
}

describe("the customer's confirmation is sent the items", () => {
  it("supplies order_items, naming the product and the option chosen", async () => {
    await placeCharger();

    const confirmation = state.emails.find((mail) => mail.slug === "order_confirmation");
    expect(confirmation, "no confirmation email was sent").toBeDefined();
    expect(confirmation?.to).toBe("asha@example.test");

    // Delete `order_items:` from the send and this is the assertion that fails —
    // without it the customer receives the literal braces, not a blank line.
    expect(confirmation?.variables.order_items).toBeDefined();
    expect(confirmation?.variables.order_items).toContain("65W Type-C Charger");
    expect(confirmation?.variables.order_items).toContain("Storage: 256 GB");
  });

  it("does not read the customer the internal photo URL", async () => {
    // `includePhotoLink` is the one difference between the two emails, and it is
    // deliberate: the baker cannot print a photo they cannot open, and the
    // customer uploaded it.
    await placeCharger();

    const confirmation = state.emails.find((mail) => mail.slug === "order_confirmation");
    expect(confirmation?.variables.order_items).not.toContain("Photo to print:");
  });

  it("tells the shop the same thing", async () => {
    await placeCharger();

    const kitchen = state.emails.find((mail) => mail.slug === "admin_new_order");
    expect(kitchen, "the shop was not told about the order").toBeDefined();
    expect(kitchen?.variables.order_items).toContain("65W Type-C Charger");
    expect(kitchen?.variables.order_items).toContain("Storage: 256 GB");
  });

  it("charges the option it names — the summary is not decoration", async () => {
    await placeCharger();

    const confirmation = state.emails.find((mail) => mail.slug === "order_confirmation");
    // 1499 + 5000. The line the email describes is the line that was billed.
    expect(confirmation?.variables.order_total).toContain("6,499");
  });
});
