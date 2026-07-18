import type { FaqCategory, FaqItem, FaqFormData } from "@/types/content";
import type { LandingFaq } from "@/constants/landing-data";
import { faqs as seedFaqs } from "@/constants/landing-data";

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

function seedFromLanding(): FaqItem[] {
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

function persist(items: FaqItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function loadFaqs(): FaqItem[] {
  if (typeof window === "undefined") return seedFromLanding();

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = seedFromLanding();
    persist(seeded);
    localStorage.setItem(STORAGE_VERSION_KEY, String(FAQ_STORAGE_VERSION));
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as FaqItem[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      const seeded = seedFromLanding();
      persist(seeded);
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
    persist(seeded);
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

export function createFaq(data: FaqFormData): FaqItem {
  const items = loadFaqs();
  const timestamp = nowIso();
  const created: FaqItem = {
    ...data,
    id: `faq-${Date.now()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  persist([...items, created]);
  return created;
}

export function updateFaq(id: string, patch: Partial<FaqFormData>): FaqItem | null {
  const items = loadFaqs();
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const updated: FaqItem = {
    ...items[index],
    ...patch,
    id,
    updatedAt: nowIso(),
  };
  items[index] = updated;
  persist(items);
  return updated;
}

export function deleteFaqs(ids: string[]): number {
  const items = loadFaqs();
  const next = items.filter((item) => !ids.includes(item.id));
  const count = items.length - next.length;
  persist(next);
  return count;
}

export function bulkUpdateFaqStatus(ids: string[], status: FaqItem["status"]): number {
  const items = loadFaqs();
  let count = 0;
  const next = items.map((item) => {
    if (!ids.includes(item.id)) return item;
    count += 1;
    return { ...item, status, updatedAt: nowIso() };
  });
  persist(next);
  return count;
}
