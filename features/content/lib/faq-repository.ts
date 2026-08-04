import type { FaqCategory, FaqItem, FaqFormData } from "@/types/content";
import type { WriteResult } from "@/lib/write-result";
import type { LandingFaq } from "@/constants/landing-data";
import { faqs as seedFaqs } from "@/constants/landing-data";
import { replaceFaqsRequest } from "./content-api";

const STORAGE_KEY = "bakery-cms-faq";
const STORAGE_VERSION_KEY = "bakery-cms-faq-version";
const FAQ_STORAGE_VERSION = 1;

function nowIso(): string {
  return new Date().toISOString();
}

function inferCategory(faq: LandingFaq, index: number): FaqCategory {
  const text = `${faq.question} ${faq.answer}`.toLowerCase();
  if (text.includes("wedding")) return "wedding";
  if (text.includes("deliver")) return "delivery";
  if (text.includes("order") || text.includes("custom")) return "orders";
  if (index % 4 === 3) return "delivery";
  if (index % 4 === 2) return "orders";
  return "general";
}

export function seedFromLanding(): FaqItem[] {
  const extra: Array<Omit<FaqItem, "id" | "createdAt" | "updatedAt">> = [
    {
      question: "Do you provide cake stands for wedding events?",
      answer:
        "Yes, premium cake stands are available for wedding orders. Mention your requirement during inquiry and our team will include options in the quote.",
      category: "wedding",
      status: "published",
      sortOrder: 6,
    },
    {
      question: "What is your cancellation policy?",
      answer:
        "Orders cancelled 48 hours before the scheduled date receive a full refund. Cancellations within 48 hours may incur a preparation fee depending on customization level.",
      category: "orders",
      status: "published",
      sortOrder: 7,
    },
    {
      question: "Do you offer midnight delivery for birthdays?",
      answer:
        "Midnight delivery is available in select metro cities for orders placed at least 24 hours in advance. Additional charges may apply.",
      category: "delivery",
      status: "published",
      sortOrder: 8,
    },
  ];

  const fromLanding = seedFaqs.map((faq, index) => ({
    id: faq.id,
    question: faq.question,
    answer: faq.answer,
    category: inferCategory(faq, index),
    status: "published" as const,
    sortOrder: index + 1,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }));

  const timestamp = nowIso();
  const extras = extra.map((item, index) => ({
    ...item,
    id: `faq-extra-${index + 1}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));

  return [...fromLanding, ...extras];
}

/** Local-only write. Used by the seed/migration paths (no server dual-write). */
function lowPersist(items: FaqItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

/** Mutation write: local first, then the server, reporting what the server did. */
async function persist(items: FaqItem[]): Promise<boolean> {
  lowPersist(items);
  return replaceFaqsRequest(items);
}

/** Hydration: write the server's FAQs into the local cache (no re-push). */
export function persistServerFaqs(items: FaqItem[]): void {
  lowPersist(items);
}

export function loadFaqs(): FaqItem[] {
  if (typeof window === "undefined") return seedFromLanding();

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = seedFromLanding();
    lowPersist(seeded);
    localStorage.setItem(STORAGE_VERSION_KEY, String(FAQ_STORAGE_VERSION));
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as FaqItem[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seeded = seedFromLanding();
      // Local-only: re-seeding must NOT push defaults back to the server, or an
      // admin who deleted every FAQ would have them resurrected on reload.
      lowPersist(seeded);
      localStorage.setItem(STORAGE_VERSION_KEY, String(FAQ_STORAGE_VERSION));
      return seeded;
    }

    const storedVersion = Number(localStorage.getItem(STORAGE_VERSION_KEY) ?? 0);
    if (storedVersion < FAQ_STORAGE_VERSION) {
      localStorage.setItem(STORAGE_VERSION_KEY, String(FAQ_STORAGE_VERSION));
    }

    return parsed;
  } catch {
    const seeded = seedFromLanding();
    lowPersist(seeded);
    localStorage.setItem(STORAGE_VERSION_KEY, String(FAQ_STORAGE_VERSION));
    return seeded;
  }
}

export function getPublishedFaqs(category?: FaqCategory): FaqItem[] {
  return loadFaqs()
    .filter((item) => item.status === "published")
    .filter((item) => !category || item.category === category)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function toLandingFaq(item: FaqItem): LandingFaq {
  return {
    id: item.id,
    question: item.question,
    answer: item.answer,
  };
}

export function getFaqById(id: string): FaqItem | null {
  return loadFaqs().find((item) => item.id === id) ?? null;
}

export function createEmptyFaqForm(): FaqFormData {
  return {
    question: "",
    answer: "",
    category: "general",
    status: "draft",
    sortOrder: loadFaqs().length + 1,
  };
}

export async function createFaq(data: FaqFormData): Promise<WriteResult<FaqItem>> {
  const items = loadFaqs();
  const timestamp = nowIso();
  const created: FaqItem = {
    ...data,
    id: `faq-${Date.now()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return { value: created, persisted: await persist([...items, created]) };
}

export async function updateFaq(
  id: string,
  patch: Partial<FaqFormData>
): Promise<WriteResult<FaqItem | null>> {
  const items = loadFaqs();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return { value: null, persisted: false };

  const updated: FaqItem = {
    ...items[index],
    ...patch,
    id,
    updatedAt: nowIso(),
  };
  items[index] = updated;
  return { value: updated, persisted: await persist(items) };
}

export async function deleteFaqs(ids: string[]): Promise<WriteResult<number>> {
  const items = loadFaqs();
  const next = items.filter((item) => !ids.includes(item.id));
  const count = items.length - next.length;
  return { value: count, persisted: await persist(next) };
}

export async function bulkUpdateFaqStatus(
  ids: string[],
  status: FaqItem["status"]
): Promise<WriteResult<number>> {
  const items = loadFaqs();
  let count = 0;
  const next = items.map((item) => {
    if (!ids.includes(item.id)) return item;
    count += 1;
    return { ...item, status, updatedAt: nowIso() };
  });
  return { value: count, persisted: await persist(next) };
}
