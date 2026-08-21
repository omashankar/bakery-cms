/**
 * The WhatsApp templates a new shop ships with.
 *
 * These literals used to live in the admin's browser store,
 * apps/admin/communications/lib/whatsapp-templates-repository.ts, alongside the
 * localStorage CRUD that renders them. But they are the shipped default
 * CONTENT of the whatsapp-templates collection, and
 * features/communications/server/communications.service.ts seeds MongoDB from
 * them — so a SERVER module had to import an admin repository and drag
 * ./communications-api's whole browser subtree into the server graph with it.
 *
 * `unlinked` travels with the seed because it is spread only by the seed; the
 * repository keeps its own nowIso(), which its save and create paths still
 * need, and imports this function back.
 */

import type { WhatsAppTemplateRecord } from "@/types/communication";

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * The Meta half of a seeded template, unfilled.
 *
 * `metaName` is deliberately BLANK. It has to be the name of a template the
 * shop's own WhatsApp Business Account has had approved, and no default can
 * guess that — a plausible-looking `order_confirmation_v1` would just fail at
 * send time with "template does not exist", which reads like a bug in this app
 * rather than a step nobody has done yet.
 *
 * `metaParameters` IS pre-filled, because it is the one part that is genuinely
 * a suggestion: it says which values this shop would put in `{{1}}`, `{{2}}`, …
 * and in what order, which is exactly what an admin needs in front of them when
 * they write the template in Meta's dashboard. It is editable, and the send
 * path uses whatever it ends up as.
 *
 * `approval` starts unsubmitted and can only be changed by asking Meta.
 */
const unlinked = {
  metaName: "",
  metaLanguage: "en",
  approval: "not_submitted" as const,
};

export function seedWhatsAppTemplates(): WhatsAppTemplateRecord[] {
  const timestamp = nowIso();
  const base = { createdAt: timestamp, updatedAt: timestamp, status: "active" as const };

  return [
    {
      id: "wa-welcome",
      slug: "welcome",
      name: "Welcome message",
      description: "Greeting after signup or first order.",
      category: "utility",
      body: `Hi {{customer_name}} 👋\nWelcome to {{store_name}}! Order fresh cakes anytime.\nNeed help? Reply HELP or call {{store_phone}}.`,
      variables: ["customer_name", "store_name", "store_phone"],
      ...unlinked,
      metaParameters: ["customer_name", "store_name", "store_phone"],
      ...base,
    },
    {
      id: "wa-order-confirmation",
      slug: "order_confirmation",
      name: "Order confirmation",
      description: "Instant order acknowledgement.",
      category: "transactional",
      // No tracking link, and that is a platform constraint rather than an
      // omission: a URL has to sit inside the wording Meta approved, so it
      // cannot be passed per-message the way it can in an email. The seed
      // carried `{{invoice_url}}` regardless — so the template this project
      // SHIPS declared a variable its own sender does not supply, and the
      // customer would have received the braces verbatim.
      body: `✅ Order {{order_number}} confirmed!\nAmount: {{order_total}}\nDelivery: {{delivery_date}}\n— {{store_name}}`,
      variables: ["order_number", "order_total", "delivery_date", "store_name"],
      ...unlinked,
      metaParameters: ["order_number", "order_total", "delivery_date"],
      ...base,
    },
    {
      id: "wa-order-ready",
      slug: "order_ready",
      name: "Cake ready",
      description: "Pickup or dispatch ready alert.",
      category: "transactional",
      body: `🎂 Great news {{customer_name}}!\nYour cake for order {{order_number}} is ready and will be dispatched soon.\n— {{store_name}}`,
      variables: ["customer_name", "order_number", "store_name"],
      ...unlinked,
      metaParameters: ["customer_name", "order_number"],
      ...base,
    },
    {
      id: "wa-delivery-update",
      slug: "delivery_update",
      name: "Delivery update",
      description: "Rider dispatched / out for delivery.",
      category: "transactional",
      body: `🚚 Order {{order_number}} is out for delivery.\nExpected today at {{delivery_address}}.\nQuestions? {{store_phone}}`,
      variables: ["order_number", "delivery_address", "store_phone"],
      ...unlinked,
      metaParameters: ["order_number", "delivery_address"],
      ...base,
    },
    {
      id: "wa-payment-reminder",
      slug: "payment_reminder",
      name: "Payment reminder",
      description: "Pending online payment follow-up.",
      category: "utility",
      body: `Hi {{customer_name}}, payment for order {{order_number}} ({{order_total}}) is still pending.\nComplete payment to confirm your slot.`,
      variables: ["customer_name", "order_number", "order_total"],
      ...unlinked,
      metaParameters: ["customer_name", "order_number", "order_total"],
      status: "draft",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
}
