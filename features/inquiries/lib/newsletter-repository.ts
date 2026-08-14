import { createHydrationGate } from "@/lib/hydration-gate";
import type { NewsletterSubscriber } from "@/types/inquiry";
import {
  subscribeRequest,
  updateSubscriberRequest,
  deleteSubscribersRequest,
} from "./newsletter-api";

const STORAGE_KEY = "bakery-cms-newsletter-subscribers";

export const NEWSLETTER_UPDATED_EVENT = "bakery-newsletter-updated";

/**
 * Open once the SERVER's subscribers have been read — see `inquiriesHydration`,
 * of which this is the exact twin. `loadNewsletterSubscribers` returns `[]` for
 * an absent key, and the key is a cache the server fills, so a first login read
 * the empty cache as an answer and told the admin the shop had no mailing list.
 */
export const newsletterHydration = createHydrationGate();

function nowIso(): string {
  return new Date().toISOString();
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString();
}

export function seedSubscribers(): NewsletterSubscriber[] {
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
  window.dispatchEvent(new Event(NEWSLETTER_UPDATED_EVENT));
}

/** Hydration: replace the local cache with the server's subscribers (no re-push). */
export function persistServerSubscribers(subscribers: NewsletterSubscriber[]): void {
  persistSubscribers(subscribers);
  newsletterHydration.markSettled();
}

/**
 * The admin's cached subscriber list. A CACHE — never a source of subscribers.
 *
 * Empty used to mean "not seeded yet": `parsed.length > 0 ? parsed : seed()`.
 * So an admin who cleared the list watched 15 demo subscribers reappear on the
 * next read, and the Total and Active stat cards counted them as real people
 * the shop could mail.
 *
 * The SERVER seeds a demo shop once, against a flag that survives deletions.
 * Empty here now means empty, and the list fills when
 * `useNewsletterServerSync` hydrates it.
 */
export function loadNewsletterSubscribers(): NewsletterSubscriber[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as NewsletterSubscriber[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * A write, plus whether the SERVER took it.
 *
 * The local list is a cache the next hydration overwrites, so a subscriber the
 * server never received is one this browser thinks it signed up and who will
 * never receive anything.
 */
export interface SubscriberWriteResult {
  subscriber: NewsletterSubscriber | null;
  persisted: boolean;
}

export async function addNewsletterSubscriber(
  email: string,
  source = "Website"
): Promise<SubscriberWriteResult> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return { subscriber: null, persisted: false };

  const subscribers = loadNewsletterSubscribers();
  const existing = subscribers.find((item) => item.email === trimmed);
  if (existing) {
    // Reactivate locally + tell the server via the PUBLIC subscribe route (it
    // dedupes + reactivates by email). Not the admin PATCH — this runs on the
    // storefront where there is no admin session.
    const result = existing.isActive
      ? existing
      : (() => {
          const next = subscribers.map((item) =>
            item.id === existing.id ? { ...item, isActive: true, updatedAt: nowIso() } : item
          );
          persistSubscribers(next);
          return { ...existing, isActive: true };
        })();
    const persisted = await subscribeRequest({
      id: result.id,
      email: trimmed,
      source: result.source,
    });
    return { subscriber: result, persisted };
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
  return { subscriber: created, persisted: await subscribeRequest(created) };
}

export async function updateNewsletterSubscriber(
  id: string,
  patch: Partial<NewsletterSubscriber>
): Promise<SubscriberWriteResult> {
  const subscribers = loadNewsletterSubscribers();
  const index = subscribers.findIndex((item) => item.id === id);
  if (index === -1) return { subscriber: null, persisted: false };

  const updated: NewsletterSubscriber = {
    ...subscribers[index],
    ...patch,
    id,
    updatedAt: nowIso(),
  };
  subscribers[index] = updated;
  persistSubscribers(subscribers);
  return { subscriber: updated, persisted: await updateSubscriberRequest(id, patch) };
}

export async function deleteNewsletterSubscribers(
  ids: string[]
): Promise<{ count: number; persisted: boolean }> {
  const subscribers = loadNewsletterSubscribers();
  const next = subscribers.filter((item) => !ids.includes(item.id));
  const count = subscribers.length - next.length;
  persistSubscribers(next);
  return { count, persisted: await deleteSubscribersRequest(ids) };
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
