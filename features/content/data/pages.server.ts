import { createMongoStore } from "@/lib/server/db/cms-store";
import { seedPages } from "@/features/content/lib/pages-repository";
import type { CmsPage, CmsPageFormData } from "@/types/content";

/**
 * Server-side CMS page store (MongoDB-backed).
 *
 * Storefront pages (About, Privacy, Terms, …) read this at render time, so they
 * ship real content in their HTML instead of a client-only skeleton.
 */
/**
 * `isValid` used to require `pages.length > 0`.
 *
 * `createMongoStore` treats an invalid stored value exactly as a missing one: it
 * re-seeds and writes the seed back. So an empty page list was indistinguishable
 * from a shop that had never been set up, and an admin who deleted every page
 * they did not want got all four shipped demo pages — About, Privacy, Terms,
 * Shipping — back on the very next read, written to the database and served to
 * customers. Verified against the running shop: emptied the store, one read, four
 * pages returned and persisted.
 *
 * The same bug this repo has already been fixed for in delivery zones, coupons,
 * inquiries, reviews and products, where "empty" also could not tell a new shop
 * from one that had deliberately cleared the list. Those use a `seeded:` marker
 * key because they are collections; a single stored array does not need one —
 * the document existing IS the marker. Only a missing or non-array value seeds.
 */
const store = createMongoStore<CmsPage[]>({
  key: "pages",
  seed: seedPages,
  isValid: (pages) => Array.isArray(pages),
});

function nowIso(): string {
  return new Date().toISOString();
}

/** A draft whose scheduled moment has arrived. Archived pages are left alone. */
function isScheduleDue(page: CmsPage, now: number): boolean {
  return Boolean(
    page.status === "draft" &&
      page.scheduledPublishAt &&
      new Date(page.scheduledPublishAt).getTime() <= now,
  );
}

/**
 * Read the pages, publishing any whose scheduled moment has passed.
 *
 * The editor offers "Schedule publish" and tells the admin it "auto-publishes
 * when due in admin or storefront"; the list shows a Scheduled badge; the value
 * was stored. Nothing ever acted on it. The one function that would have —
 * `processScheduledPagePublishes` — lives in the browser-only repository and has
 * no caller anywhere in the repo, and the server read only ever asked whether
 * `status === "published"`. So an admin scheduled a Diwali page for 09:00, and
 * at 09:00 and every moment after it the storefront answered 404.
 *
 * Check-on-read, exactly as the homepage and wedding builders do it — there is
 * no cron here either. The re-check inside `mutate` stops two concurrent reads
 * publishing twice.
 */
async function readWithSchedule(): Promise<CmsPage[]> {
  const pages = await store.read();
  if (!pages.some((page) => isScheduleDue(page, Date.now()))) return pages;

  return store.mutate((current) => {
    const now = Date.now();
    if (!current.some((page) => isScheduleDue(page, now))) {
      return { next: current, result: current };
    }
    const next = current.map((page) =>
      isScheduleDue(page, now)
        ? {
            ...page,
            status: "published" as const,
            scheduledPublishAt: undefined,
            updatedAt: nowIso(),
          }
        : page,
    );
    return { next, result: next };
  });
}

export async function getPages(): Promise<CmsPage[]> {
  return readWithSchedule();
}

export async function getPublishedPages(): Promise<CmsPage[]> {
  return (await readWithSchedule()).filter((page) => page.status === "published");
}

export async function getPageById(id: string): Promise<CmsPage | null> {
  return (await readWithSchedule()).find((page) => page.id === id) ?? null;
}

/** Published page by slug; `preview` also allows drafts through. */
export async function getPageForStorefront(
  slug: string,
  preview = false
): Promise<CmsPage | null> {
  const page = (await readWithSchedule()).find((item) => item.slug === slug) ?? null;
  if (!page) return null;
  if (preview) return page;
  return page.status === "published" ? page : null;
}

export async function createPage(data: CmsPageFormData): Promise<CmsPage> {
  return store.mutate((pages) => {
    const timestamp = nowIso();
    const page = {
      ...data,
      id: `page-${Date.now()}`,
      createdAt: timestamp,
      updatedAt: timestamp,
    } as CmsPage;
    return { next: [page, ...pages], result: page };
  });
}

export async function updatePage(
  id: string,
  patch: Partial<CmsPageFormData>
): Promise<CmsPage | null> {
  return store.mutate((pages) => {
    const index = pages.findIndex((page) => page.id === id);
    if (index === -1) return { next: pages, result: null };

    const updated = { ...pages[index], ...patch, id, updatedAt: nowIso() } as CmsPage;
    const next = [...pages];
    next[index] = updated;
    return { next, result: updated };
  });
}

export async function deletePage(id: string): Promise<boolean> {
  return store.mutate((pages) => {
    const next = pages.filter((page) => page.id !== id);
    return { next, result: next.length !== pages.length };
  });
}

/** Test helper: drop the store so the next read re-seeds. */
export const resetPagesStore = store.reset;
