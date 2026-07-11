import type { NewsletterSubscriber } from "@/types/inquiry";

const STORAGE_KEY = "bakery-cms-newsletter-subscribers";

function nowIso(): string {
  return new Date().toISOString();
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function seedSubscribers(): NewsletterSubscriber[] {
  const sources = ["Footer", "Homepage", "Checkout", "Landing", "Popup"];

  return [
    "ananya.patel@email.com",
    "priya.sharma@email.com",
    "rahul.mehta@email.com",
    "newsletter.fan@email.com",
    "cake.lover@email.com",
    "sweet.tooth@email.com",
    "bakery.club@email.com",
    "monday.deals@email.com",
    "weekend.baker@email.com",
    "festive.orders@email.com",
    "custom.cakes@email.com",
    "wedding.planner@email.com",
    "corporate.events@email.com",
    "family.celebrations@email.com",
    "dessert.diary@email.com",
  ].map((email, index) => ({
    id: `sub-${index + 1}`,
    email,
    isActive: index % 5 !== 0,
    source: sources[index % sources.length],
    createdAt: daysAgo(index * 3),
    updatedAt: daysAgo(index % 7),
  }));
}

function persistSubscribers(subscribers: NewsletterSubscriber[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(subscribers));
}

export function loadNewsletterSubscribers(): NewsletterSubscriber[] {
  if (typeof window === "undefined") return seedSubscribers();

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const seeded = seedSubscribers();
    persistSubscribers(seeded);
    return seeded;
  }

  try {
    const parsed = JSON.parse(raw) as NewsletterSubscriber[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : seedSubscribers();
  } catch {
    return seedSubscribers();
  }
}

export function addNewsletterSubscriber(
  email: string,
  source = "Website"
): NewsletterSubscriber | null {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return null;

  const subscribers = loadNewsletterSubscribers();
  const existing = subscribers.find((item) => item.email === trimmed);
  if (existing) {
    if (!existing.isActive) {
      return updateNewsletterSubscriber(existing.id, { isActive: true });
    }
    return existing;
  }

  const timestamp = nowIso();
  const created: NewsletterSubscriber = {
    id: `sub-${Date.now()}`,
    email: trimmed,
    isActive: true,
    source,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  persistSubscribers([created, ...subscribers]);
  return created;
}

export function updateNewsletterSubscriber(
  id: string,
  patch: Partial<NewsletterSubscriber>
): NewsletterSubscriber | null {
  const subscribers = loadNewsletterSubscribers();
  const index = subscribers.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const updated: NewsletterSubscriber = {
    ...subscribers[index],
    ...patch,
    id,
    updatedAt: nowIso(),
  };
  subscribers[index] = updated;
  persistSubscribers(subscribers);
  return updated;
}

export function deleteNewsletterSubscribers(ids: string[]): number {
  const subscribers = loadNewsletterSubscribers();
  const next = subscribers.filter((item) => !ids.includes(item.id));
  const count = subscribers.length - next.length;
  persistSubscribers(next);
  return count;
}

export interface NewsletterFilters {
  search: string;
  status: "all" | "active" | "inactive";
  sort: "newest" | "oldest" | "email";
}

export const defaultNewsletterFilters: NewsletterFilters = {
  search: "",
  status: "all",
  sort: "newest",
};

export function filterNewsletterSubscribers(
  subscribers: NewsletterSubscriber[],
  filters: NewsletterFilters
): NewsletterSubscriber[] {
  const query = filters.search.trim().toLowerCase();

  return subscribers
    .filter((subscriber) => {
      if (filters.status === "active" && !subscriber.isActive) return false;
      if (filters.status === "inactive" && subscriber.isActive) return false;
      if (query && !subscriber.email.toLowerCase().includes(query)) return false;
      return true;
    })
    .sort((a, b) => {
      if (filters.sort === "email") return a.email.localeCompare(b.email);
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return filters.sort === "newest" ? bTime - aTime : aTime - bTime;
    });
}
