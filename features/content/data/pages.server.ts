import { createJsonStore } from "@/lib/server/json-store";
import { seedPages } from "@/features/content/lib/pages-repository";
import type { CmsPage, CmsPageFormData } from "@/types/content";

/**
 * Server-side CMS page store.
 *
 * Storefront pages (About, Privacy, Terms, …) read this at render time, so they
 * ship real content in their HTML instead of a client-only skeleton.
 */
const store = createJsonStore<CmsPage[]>({
  file: "pages.json",
  seed: seedPages,
  isValid: (pages) => Array.isArray(pages) && pages.length > 0,
});

function nowIso(): string {
  return new Date().toISOString();
}

export async function getPages(): Promise<CmsPage[]> {
  return store.read();
}

export async function getPublishedPages(): Promise<CmsPage[]> {
  return (await store.read()).filter((page) => page.status === "published");
}

export async function getPageById(id: string): Promise<CmsPage | null> {
  return (await store.read()).find((page) => page.id === id) ?? null;
}

/** Published page by slug; `preview` also allows drafts through. */
export async function getPageForStorefront(
  slug: string,
  preview = false
): Promise<CmsPage | null> {
  const page = (await store.read()).find((item) => item.slug === slug) ?? null;
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
