import type { WhatsAppTemplateFormData, WhatsAppTemplateRecord } from "@/types/communication";
import { mergeTemplateVariables } from "./template-render";

const STORAGE_KEY = "bakery-cms-whatsapp-templates";
const STORAGE_VERSION_KEY = "bakery-cms-whatsapp-templates-version";
const STORAGE_VERSION = 1;

export const WHATSAPP_TEMPLATES_UPDATED_EVENT = "bakery-whatsapp-templates-updated";

function nowIso(): string {
  return new Date().toISOString();
}

function emitUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(WHATSAPP_TEMPLATES_UPDATED_EVENT));
}

function seedWhatsAppTemplates(): WhatsAppTemplateRecord[] {
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
      ...base,
    },
    {
      id: "wa-order-confirmation",
      slug: "order_confirmation",
      name: "Order confirmation",
      description: "Instant order acknowledgement.",
      category: "transactional",
      body: `✅ Order {{order_number}} confirmed!\nAmount: {{order_total}}\nDelivery: {{delivery_date}}\nTrack: {{invoice_url}}\n— {{store_name}}`,
      variables: [
        "order_number",
        "order_total",
        "delivery_date",
        "invoice_url",
        "store_name",
      ],
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
      status: "draft",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];
}

function readTemplates(): WhatsAppTemplateRecord[] {
  if (typeof window === "undefined") return seedWhatsAppTemplates();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WhatsAppTemplateRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeTemplates(templates: WhatsAppTemplateRecord[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  emitUpdated();
}

function normalizeTemplate(template: WhatsAppTemplateRecord): WhatsAppTemplateRecord {
  const variables = mergeTemplateVariables(template.variables ?? [], [template.body]);
  return { ...template, variables };
}

export function loadWhatsAppTemplates(): WhatsAppTemplateRecord[] {
  if (typeof window === "undefined") return seedWhatsAppTemplates();

  const version = Number(localStorage.getItem(STORAGE_VERSION_KEY) ?? 0);
  const existing = readTemplates();

  if (existing.length === 0 || version < STORAGE_VERSION) {
    const seeded =
      existing.length > 0 ? existing.map(normalizeTemplate) : seedWhatsAppTemplates();
    writeTemplates(seeded);
    localStorage.setItem(STORAGE_VERSION_KEY, String(STORAGE_VERSION));
    return seeded;
  }

  return existing.map(normalizeTemplate);
}

export function getWhatsAppTemplateById(id: string): WhatsAppTemplateRecord | null {
  return loadWhatsAppTemplates().find((template) => template.id === id) ?? null;
}

export function saveWhatsAppTemplate(
  id: string,
  data: WhatsAppTemplateFormData
): WhatsAppTemplateRecord | null {
  const templates = loadWhatsAppTemplates();
  const index = templates.findIndex((template) => template.id === id);
  if (index === -1) return null;

  const updated: WhatsAppTemplateRecord = normalizeTemplate({
    ...templates[index],
    ...data,
    id,
    updatedAt: nowIso(),
  });
  templates[index] = updated;
  writeTemplates(templates);
  return updated;
}

export function createWhatsAppTemplate(data: WhatsAppTemplateFormData): WhatsAppTemplateRecord {
  const templates = loadWhatsAppTemplates();
  const timestamp = nowIso();
  const template = normalizeTemplate({
    ...data,
    id: `wa-${Date.now()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  writeTemplates([template, ...templates]);
  return template;
}

export function deleteWhatsAppTemplate(id: string): boolean {
  const templates = loadWhatsAppTemplates();
  const next = templates.filter((template) => template.id !== id);
  if (next.length === templates.length) return false;
  writeTemplates(next);
  return true;
}

export function resetWhatsAppTemplates(): WhatsAppTemplateRecord[] {
  const seeded = seedWhatsAppTemplates();
  writeTemplates(seeded);
  localStorage.setItem(STORAGE_VERSION_KEY, String(STORAGE_VERSION));
  return seeded;
}
