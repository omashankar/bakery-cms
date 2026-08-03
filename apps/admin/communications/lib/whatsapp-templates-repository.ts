import type { WhatsAppTemplateFormData, WhatsAppTemplateRecord } from "@/types/communication";
import { mergeTemplateVariables } from "@/lib/template-render";
import {
  whatsappTemplatesHydration,
  replaceWhatsAppTemplatesRequest,
} from "./communications-api";
import type { WriteResult } from "@/lib/write-result";

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

/**
 * Local write first, then the server — and the local write is UNDONE when the
 * server refuses.
 *
 * Without the rollback a refused save still changed localStorage, so the page
 * reloaded its list from that cache, found it matched the editor, and showed
 * "All changes saved" with the Save button greyed out — for a change the
 * server had rejected. The admin's only warning was a toast they had already
 * dismissed, and the next hydration silently replaced their work.
 *
 * Keeping the cache to things the server has actually accepted costs one save
 * on a refusal instead of quietly losing it. `delivery-zones-repository.ts`
 * does the same, including the concurrency guard below.
 */
async function persistAndSync(templates: WhatsAppTemplateRecord[]): Promise<boolean> {
  const previous = typeof window === "undefined" ? null : localStorage.getItem(STORAGE_KEY);

  writeTemplates(templates);
  const accepted = await replaceWhatsAppTemplatesRequest(templates);

  // Roll back ONLY if this write is still the one in the cache. Restoring the
  // entry snapshot unconditionally would undo a concurrent save the server had
  // accepted in the meantime — a rejected write destroying a good one.
  if (!accepted && typeof window !== "undefined") {
    const stillOurs = localStorage.getItem(STORAGE_KEY) === JSON.stringify(templates);
    if (stillOurs) {
      if (previous === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, previous);
      emitUpdated();
    }
  }

  return accepted;
}

/** Hydration: write the server's templates into the local cache (no re-push). */
export function persistServerWhatsAppTemplates(templates: WhatsAppTemplateRecord[]): void {
  if (typeof window === "undefined") return;
  writeTemplates(templates);
  localStorage.setItem(STORAGE_VERSION_KEY, String(STORAGE_VERSION));
}

function normalizeTemplate(template: WhatsAppTemplateRecord): WhatsAppTemplateRecord {
  const variables = mergeTemplateVariables(template.variables ?? [], [template.body]);
  return { ...template, variables };
}

export function loadWhatsAppTemplates(): WhatsAppTemplateRecord[] {
  if (typeof window === "undefined") return seedWhatsAppTemplates();

  const version = Number(localStorage.getItem(STORAGE_VERSION_KEY) ?? 0);
  const existing = readTemplates();

  // Only an ABSENT store gets the demo seed. An empty one is the shop saying it
  // has no templates, and re-seeding over that is how the demo set kept coming
  // back after a delete.
  if (existing === null || version < STORAGE_VERSION) {
    const seeded =
      existing === null ? seedWhatsAppTemplates() : existing.map(normalizeTemplate);
    writeTemplates(seeded);
    localStorage.setItem(STORAGE_VERSION_KEY, String(STORAGE_VERSION));
    return seeded;
  }

  return existing.map(normalizeTemplate);
}

export function getWhatsAppTemplateById(id: string): WhatsAppTemplateRecord | null {
  return loadWhatsAppTemplates().find((template) => template.id === id) ?? null;
}

/**
 * Read the list AFTER hydration, then write it.
 *
 * The gate guarded the PUT but not the READ that composed it. Every mutation
 * called `loadWhatsAppTemplates()` first, so an admin who clicked before the
 * server's copy arrived built their payload from the DEMO SEED — that loader
 * seeds it when the cache is empty. `guardedPut` then waited politely for the
 * gate, the gate opened, and it shipped the seed as a whole-collection
 * replace: the seed-clobber the gate exists to prevent, surviving inside it.
 *
 * `delivery-zones-repository.ts` documents and fixes this exact ordering; the
 * template stores were written before that and never caught up.
 */
async function mutateWhatsAppTemplates<T>(
  /** Returned when hydration never lands, so callers never see `undefined`. */
  fallback: T,
  mutate: (
    current: WhatsAppTemplateRecord[],
  ) =>
    | { next: WhatsAppTemplateRecord[]; value: T }
    | { value: T; next?: undefined },
): Promise<WriteResult<T>> {
  if (!(await whatsappTemplatesHydration.waitForSettled())) {
    return { value: fallback, persisted: false };
  }

  const outcome = mutate(loadWhatsAppTemplates());
  // Nothing to write is only success when nothing was asked for.
  if (outcome.next === undefined) return { value: outcome.value, persisted: false };

  return { value: outcome.value, persisted: await persistAndSync(outcome.next) };
}

export async function saveWhatsAppTemplate(
  id: string,
  data: WhatsAppTemplateFormData
): Promise<WriteResult<WhatsAppTemplateRecord | null>> {
  return mutateWhatsAppTemplates<WhatsAppTemplateRecord | null>(null, (current) => {
    const templates = [...current];
    const index = templates.findIndex((template) => template.id === id);
    // Not in the SERVER's list: another admin deleted it mid-edit.
    if (index === -1) return { value: null };

    const updated: WhatsAppTemplateRecord = normalizeTemplate({
      ...templates[index],
      ...data,
      id,
      updatedAt: nowIso(),
    });
    templates[index] = updated;
    return { next: templates, value: updated };
  });
}

export async function createWhatsAppTemplate(
  data: WhatsAppTemplateFormData
): Promise<WriteResult<WhatsAppTemplateRecord>> {
  const timestamp = nowIso();
  const template = normalizeTemplate({
    ...data,
    id: `wa-${Date.now()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return mutateWhatsAppTemplates(template, (current) => ({
    next: [template, ...current],
    value: template,
  }));
}

/** `value` is false when no such template existed, so nothing was sent. */
export async function deleteWhatsAppTemplate(id: string): Promise<WriteResult<boolean>> {
  return mutateWhatsAppTemplates(false, (current) => {
    const next = current.filter((template) => template.id !== id);
    if (next.length === current.length) return { value: false };
    return { next, value: true };
  });
}


export async function resetWhatsAppTemplates(): Promise<WriteResult<WhatsAppTemplateRecord[]>> {
  const seeded = seedWhatsAppTemplates();
  const persisted = await persistAndSync(seeded);
  localStorage.setItem(STORAGE_VERSION_KEY, String(STORAGE_VERSION));
  return { value: seeded, persisted };
}
