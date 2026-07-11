import type { EmailTemplateFormData, EmailTemplateRecord } from "@/types/communication";
import { mergeTemplateVariables } from "./template-render";

const STORAGE_KEY = "bakery-cms-email-templates";
const STORAGE_VERSION_KEY = "bakery-cms-email-templates-version";
const STORAGE_VERSION = 1;

export const EMAIL_TEMPLATES_UPDATED_EVENT = "bakery-email-templates-updated";

function nowIso(): string {
  return new Date().toISOString();
}

function emitUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EMAIL_TEMPLATES_UPDATED_EVENT));
}

function seedEmailTemplates(): EmailTemplateRecord[] {
  const timestamp = nowIso();
  const base = { createdAt: timestamp, updatedAt: timestamp, status: "active" as const };

  return [
    {
      id: "email-welcome",
      slug: "welcome",
      name: "Welcome email",
      description: "Sent after a customer creates an account.",
      category: "transactional",
      subject: "Welcome to {{store_name}}",
      previewText: "We're glad you're here — explore our fresh cakes.",
      body: `Hi {{customer_name}},\n\nWelcome to {{store_name}}! We're excited to help you celebrate every occasion with freshly baked cakes.\n\nBrowse collections: {{support_url}}\n\nWarm regards,\n{{store_name}} Team`,
      variables: ["customer_name", "store_name", "support_url"],
      ...base,
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
    {
      id: "email-password-reset",
      slug: "password_reset",
      name: "Password reset",
      description: "Account password reset link.",
      category: "system",
      subject: "Reset your {{store_name}} password",
      previewText: "Use the secure link to reset your password.",
      body: `Hi {{customer_name}},\n\nWe received a request to reset your password.\n\nReset link: {{reset_link}}\n\nIf you didn't request this, ignore this email.\n\n— {{store_name}} Support`,
      variables: ["customer_name", "store_name", "reset_link"],
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

function readTemplates(): EmailTemplateRecord[] {
  if (typeof window === "undefined") return seedEmailTemplates();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as EmailTemplateRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTemplates(templates: EmailTemplateRecord[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  emitUpdated();
}

function normalizeTemplate(template: EmailTemplateRecord): EmailTemplateRecord {
  const variables = mergeTemplateVariables(template.variables ?? [], [
    template.subject,
    template.previewText ?? "",
    template.body,
  ]);

  return {
    ...template,
    variables,
  };
}

export function loadEmailTemplates(): EmailTemplateRecord[] {
  if (typeof window === "undefined") return seedEmailTemplates();

  const version = Number(localStorage.getItem(STORAGE_VERSION_KEY) ?? 0);
  const existing = readTemplates();

  if (existing.length === 0 || version < STORAGE_VERSION) {
    const seeded = existing.length > 0 ? existing.map(normalizeTemplate) : seedEmailTemplates();
    writeTemplates(seeded);
    localStorage.setItem(STORAGE_VERSION_KEY, String(STORAGE_VERSION));
    return seeded;
  }

  return existing.map(normalizeTemplate);
}

export function getEmailTemplateById(id: string): EmailTemplateRecord | null {
  return loadEmailTemplates().find((template) => template.id === id) ?? null;
}

export function getEmailTemplateBySlug(slug: string): EmailTemplateRecord | null {
  return loadEmailTemplates().find((template) => template.slug === slug) ?? null;
}

export function saveEmailTemplate(
  id: string,
  data: EmailTemplateFormData
): EmailTemplateRecord | null {
  const templates = loadEmailTemplates();
  const index = templates.findIndex((template) => template.id === id);
  if (index === -1) return null;

  const updated: EmailTemplateRecord = normalizeTemplate({
    ...templates[index],
    ...data,
    id,
    updatedAt: nowIso(),
  });
  templates[index] = updated;
  writeTemplates(templates);
  return updated;
}

export function createEmailTemplate(data: EmailTemplateFormData): EmailTemplateRecord {
  const templates = loadEmailTemplates();
  const timestamp = nowIso();
  const template = normalizeTemplate({
    ...data,
    id: `email-${Date.now()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  writeTemplates([template, ...templates]);
  return template;
}

export function deleteEmailTemplate(id: string): boolean {
  const templates = loadEmailTemplates();
  const next = templates.filter((template) => template.id !== id);
  if (next.length === templates.length) return false;
  writeTemplates(next);
  return true;
}

export function resetEmailTemplates(): EmailTemplateRecord[] {
  const seeded = seedEmailTemplates();
  writeTemplates(seeded);
  localStorage.setItem(STORAGE_VERSION_KEY, String(STORAGE_VERSION));
  return seeded;
}
