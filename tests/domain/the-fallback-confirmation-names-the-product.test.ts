import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The email that sends when the template is not there.
 *
 * `sendTemplatedEmail` resolves `stored ?? FALLBACKS[slug]`, and `findTemplate`
 * counts only a row with `status: "active"` — so the hardcoded fallback is what
 * a customer receives whenever the shop pauses the template, saves it as a
 * draft, deletes it, or the template read throws. Its own docblock says why it
 * exists: "without one, deleting a template or leaving it unpublished would
 * silently stop password resets".
 *
 * `admin_new_order` has carried `{{order_items}}` all along. `order_confirmation`
 * did not: it listed a total, a payment method and a date and named no product.
 * So the shop always knew what the order was and the customer's own record did
 * not — the same asymmetry d674c20 set out to remove, in the one file that
 * commit never opened.
 *
 * These run the REAL send path with only the transport and the template store
 * stubbed, so what is asserted is the text that would reach an inbox. A
 * source-scan would have passed on the broken code: the string
 * "{{order_items}}" was already in the file, eighteen lines lower, in the
 * shop's copy.
 */

const state = vi.hoisted(() => ({
  /** Stored templates the service will find. Empty means "fall back". */
  templates: [] as Record<string, unknown>[],
  sent: null as { subject: string; text: string; html: string; to: string } | null,
}));

vi.mock("@/lib/server/mail/send-mail", () => ({
  sendMail: async (mail: { to: string; subject: string; html: string; text: string }) => {
    state.sent = mail;
    return { sent: true };
  },
}));

vi.mock("./communications.service", () => ({
  getTemplates: async () => state.templates,
}));

vi.mock("@/features/communications/server/communications.service", () => ({
  getTemplates: async () => state.templates,
}));

vi.mock("@/features/settings/server/settings.service", () => ({
  getSettings: async () => ({
    general: { siteName: "Sweet Crumbs" },
    contact: { phone: "+91 90000 00000", email: "hello@shop.test" },
  }),
}));

vi.mock("@/features/site-layout/server/site-layout.service", () => ({
  getSiteLayout: async () => ({}),
}));

const { sendTemplatedEmail } = await import("@/features/communications/server/email.service");

const ITEMS = "  1 x 65W Type-C Charger\n      Storage: 256 GB · Colour: White";

const VARIABLES = {
  customer_name: "Asha",
  order_number: "BK-1",
  order_total: "₹6,499.00",
  payment_method: "Paid online",
  delivery_date: "2026-09-05",
  invoice_url: "https://shop.test/track?order=BK-1",
  order_items: ITEMS,
};

beforeEach(() => {
  state.templates = [];
  state.sent = null;
});

describe("the confirmation that sends when no template is active", () => {
  it("names the product and the options the customer paid for", async () => {
    await sendTemplatedEmail("order_confirmation", "asha@example.test", VARIABLES);

    expect(state.sent).not.toBeNull();
    expect(state.sent?.text).toContain("65W Type-C Charger");
    expect(state.sent?.text).toContain("Storage: 256 GB · Colour: White");
  });

  it("leaves no placeholder unresolved", async () => {
    // `renderTemplate` writes an unknown key back verbatim, so a variable the
    // body uses and the sender does not supply is mailed as literal braces.
    await sendTemplatedEmail("order_confirmation", "asha@example.test", VARIABLES);

    expect(state.sent?.text).not.toContain("{{");
    expect(state.sent?.subject).not.toContain("{{");
  });

  it("is used precisely because a paused template is not a template", async () => {
    // The row exists, but it is a draft — which is the case this fallback is for.
    state.templates = [
      {
        slug: "order_confirmation",
        status: "draft",
        subject: "Draft subject",
        body: "A draft nobody should receive.",
      },
    ];

    await sendTemplatedEmail("order_confirmation", "asha@example.test", VARIABLES);

    expect(state.sent?.text).not.toContain("A draft nobody should receive.");
    expect(state.sent?.text).toContain("65W Type-C Charger");
  });

  it("still prefers the shop's own active template over the fallback", async () => {
    // The fallback must not start overriding a shop that has customised its copy.
    state.templates = [
      {
        slug: "order_confirmation",
        status: "active",
        subject: "Your order {{order_number}}",
        body: "Our own wording. {{order_items}}",
      },
    ];

    await sendTemplatedEmail("order_confirmation", "asha@example.test", VARIABLES);

    expect(state.sent?.text).toContain("Our own wording.");
    expect(state.sent?.text).toContain("65W Type-C Charger");
  });
});

describe("the shop's copy and the customer's copy agree", () => {
  /** Send one email and hand back the plain-text body that would be delivered. */
  async function bodyOf(slug: string, variables: Record<string, string>): Promise<string> {
    state.sent = null;
    await sendTemplatedEmail(slug as never, "someone@example.test", variables);
    return state.sent === null ? "" : (state.sent as { text: string }).text;
  }

  it("both name the items", async () => {
    const customer = await bodyOf("order_confirmation", VARIABLES);
    const shop = await bodyOf("admin_new_order", {
      ...VARIABLES,
      customer_phone: "9000000000",
      delivery_address: "12 Bakery Lane, Mumbai 400001",
      admin_url: "https://shop.test/admin/orders/1",
    });

    expect(customer).toContain("65W Type-C Charger");
    expect(shop).toContain("65W Type-C Charger");
  });
});
