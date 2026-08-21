/**
 * The email templates a new shop ships with.
 *
 * These literals used to live in the admin's browser store,
 * apps/admin/communications/lib/email-templates-repository.ts, alongside the
 * localStorage CRUD that renders them. But they are the shipped default
 * CONTENT of the email-templates collection, and
 * features/communications/server/communications.service.ts seeds MongoDB from
 * them — so a SERVER module had to import an admin repository, and with it
 * ./communications-api, lib/hydration-gate and features/auth's session-expiry,
 * none of which have any business in the server graph. The seed is data; only
 * the store around it was ever admin code.
 *
 * The repository keeps its own nowIso() — its save and create paths still need
 * one — and imports this function back.
 */

import type { EmailTemplateRecord } from "@/types/communication";

function nowIso(): string {
  return new Date().toISOString();
}

export function seedEmailTemplates(): EmailTemplateRecord[] {
  const timestamp = nowIso();
  const base = { createdAt: timestamp, updatedAt: timestamp, status: "active" as const };

  return [
    {
      id: "email-welcome",
      slug: "welcome",
      name: "Welcome email",
      // DRAFT, because there is nothing to send it. Its description said "sent
      // after a customer creates an account" and this storefront has no account
      // creation — customers check out as guests. It was seeded ACTIVE, so an
      // admin could open it, word it carefully, and reasonably believe new
      // customers were receiving it. `draft` is the editor's own word for work
      // in progress, and `abandoned_cart` below already uses it for the same
      // honest reason. Flip it back the day a signup flow exists.
      description: "Not sent yet — the storefront has no customer signup flow.",
      category: "transactional",
      subject: "Welcome to {{store_name}}",
      previewText: "We're glad you're here — explore our fresh cakes.",
      body: `Hi {{customer_name}},\n\nWelcome to {{store_name}}! We're excited to help you celebrate every occasion with freshly baked cakes.\n\nBrowse collections: {{support_url}}\n\nWarm regards,\n{{store_name}} Team`,
      variables: ["customer_name", "store_name", "support_url"],
      ...base,
      status: "draft" as const,
    },
    {
      id: "email-order-confirmation",
      slug: "order_confirmation",
      name: "Order confirmation",
      description: "Sent immediately after checkout.",
      category: "transactional",
      subject: "Order {{order_number}} confirmed",
      previewText: "We've received your order and started preparing it.",
      body: `Hi {{customer_name}},\n\nThank you for your order {{order_number}}.\n\nOrder total: {{order_total}}\nPayment: {{payment_method}}\nDelivery date: {{delivery_date}}\n\nTrack your order: {{invoice_url}}\n\n— {{store_name}}`,
      variables: [
        "customer_name",
        "order_number",
        "order_total",
        "payment_method",
        "delivery_date",
        "invoice_url",
        "store_name",
      ],
      ...base,
    },
    {
      id: "email-order-shipped",
      slug: "order_shipped",
      name: "Out for delivery",
      description: "Sent when the cake leaves the bakery.",
      category: "transactional",
      subject: "Your cake is on the way — {{order_number}}",
      previewText: "Your order is out for delivery today.",
      body: `Hi {{customer_name}},\n\nGreat news! Order {{order_number}} is out for delivery.\n\nExpected delivery: {{delivery_date}}\nAddress: {{delivery_address}}\n\nNeed help? Call {{store_phone}}\n\n— {{store_name}}`,
      variables: [
        "customer_name",
        "order_number",
        "delivery_date",
        "delivery_address",
        "store_phone",
        "store_name",
      ],
      ...base,
    },
    {
      id: "email-order-cancelled",
      slug: "order_cancelled",
      name: "Order cancelled",
      description: "Sent when the shop cancels an order.",
      category: "transactional",
      subject: "Your order {{order_number}} has been cancelled",
      previewText: "We have cancelled your order.",
      // `refund_note` carries the money question, because the answer differs:
      // a paid order has a refund coming and a COD one never took anything.
      body: `Hi {{customer_name}},\n\nWe're sorry — order {{order_number}} ({{order_total}}) has been cancelled.\n\n{{refund_note}}\n\nIf this was not expected, please call us on {{store_phone}} and we will put it right.\n\n— {{store_name}}`,
      variables: [
        "customer_name",
        "order_number",
        "order_total",
        "refund_note",
        "store_phone",
        "store_name",
      ],
      ...base,
    },
    {
      id: "email-invoice",
      slug: "invoice",
      name: "Invoice email",
      description: "Invoice copy with payment summary.",
      category: "transactional",
      subject: "Invoice for order {{order_number}}",
      previewText: "Your invoice from {{store_name}}.",
      body: `Hi {{customer_name}},\n\nPlease find your invoice for order {{order_number}}.\n\nAmount paid: {{order_total}}\nOrder date: {{order_date}}\n\nView invoice: {{invoice_url}}\n\nQuestions? Email {{store_email}}\n\n— {{store_name}}`,
      variables: [
        "customer_name",
        "order_number",
        "order_total",
        "order_date",
        "invoice_url",
        "store_email",
        "store_name",
      ],
      ...base,
    },
    /**
     * The two the shop actually sends that were not on this screen at all.
     *
     * Both had hardcoded fallback copy in `email.service.ts` and no template
     * row, so they went out and the admin could not change a word. The refund
     * one is the sharper miss: it is the only email a customer receives about
     * their money, and the shop had no say in how it was worded.
     */
    {
      id: "email-refund-processed",
      slug: "refund_processed",
      name: "Refund processed",
      description: "Sent when a refund is approved and on its way back.",
      category: "transactional",
      subject: "Refund for order {{order_number}}",
      previewText: "Your refund is on its way.",
      // Deliberately says the money is on its WAY rather than that it has
      // arrived: a card refund takes days to show on a statement, and
      // "refunded" followed by a week of nothing generates exactly the support
      // call this email exists to prevent.
      body: `Hi {{customer_name}},\n\nWe have refunded {{refund_amount}} for your order {{order_number}}.\n\nIt is on its way back to the account you paid from and usually takes {{refund_eta}} to appear, depending on your bank.\n\nReference: {{refund_reference}}\n\nQuestions? Email {{store_email}}\n\n— {{store_name}}`,
      variables: [
        "customer_name",
        "order_number",
        "refund_amount",
        "refund_eta",
        "refund_reference",
        "store_email",
        "store_name",
      ],
      ...base,
    },
    {
      id: "email-admin-new-order",
      slug: "admin_new_order",
      name: "New order alert (to the shop)",
      // The one template here whose recipient is the BAKERY, not a customer.
      // Said plainly, because everything else on this screen goes outward and
      // an admin editing this one should know they are writing to themselves.
      description: "Sent to your shop's contact address when an order arrives.",
      category: "system",
      subject: "New order {{order_number}} — {{order_total}}",
      previewText: "A new order just came in.",
      body: `{{order_number}} was just placed.\n\nCustomer: {{customer_name}} ({{customer_phone}})\nTotal: {{order_total}} — {{payment_method}}\nDeliver: {{delivery_date}}\nTo: {{delivery_address}}\n\nItems:\n{{order_items}}\n\n{{admin_url}}`,
      variables: [
        "order_number",
        "order_total",
        "customer_name",
        "customer_phone",
        "payment_method",
        "delivery_date",
        "delivery_address",
        "order_items",
        "admin_url",
      ],
      ...base,
    },
    {
      id: "email-password-reset",
      slug: "password_reset",
      name: "Password reset",
      description: "Account password reset code.",
      category: "system",
      subject: "Reset your {{store_name}} password",
      previewText: "Use the code below to reset your password.",
      // The reset flow issues a one-time CODE, not a link. This copy asked for
      // {{reset_link}}, which nothing ever supplied — so even once mail was
      // wired, the code the customer needs would not have been in the email.
      body: `Hi {{customer_name}},\n\nUse this code to reset your password:\n\n{{reset_code}}\n\nIt expires in {{expires_in}}. If you didn't request this, ignore this email — your password has not changed.\n\n— {{store_name}} Support`,
      variables: ["customer_name", "store_name", "reset_code", "expires_in"],
      ...base,
    },
    {
      id: "email-customer-sign-in",
      slug: "customer_sign_in",
      name: "Customer sign-in code",
      description: "One-time code a customer uses to sign in and see their orders.",
      category: "system",
      subject: "Your {{store_name}} sign-in code",
      previewText: "Use the code below to sign in.",
      body: `Hi {{customer_name}},\n\nUse this code to sign in and see your orders:\n\n{{sign_in_code}}\n\nIt expires in {{expires_in}}. If you didn't ask to sign in, you can ignore this email — nobody can use the code without it.\n\n— {{store_name}}`,
      variables: ["customer_name", "store_name", "sign_in_code", "expires_in"],
      ...base,
    },
    {
      id: "email-abandoned-cart",
      slug: "abandoned_cart",
      name: "Abandoned cart reminder",
      description: "Nudge customers who left items in cart.",
      category: "marketing",
      subject: "Your cakes are waiting at {{store_name}}",
      previewText: "Complete checkout before your favourites sell out.",
      body: `Hi {{customer_name}},\n\nYou left something delicious in your cart.\n\nReturn to checkout: {{cart_url}}\n\nUse code {{coupon_code}} for a sweet surprise on your next order.\n\n— {{store_name}}`,
      variables: ["customer_name", "store_name", "cart_url", "coupon_code"],
      status: "draft",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
}
