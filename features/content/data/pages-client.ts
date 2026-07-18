import type { CmsPage, CmsPageFormData } from "@/types/content";

/** Browser-side CMS page access for the admin editor. */

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed (${response.status})`);
  }
  return payload as T;
}

export async function fetchPages(): Promise<CmsPage[]> {
  const { pages } = await request<{ pages: CmsPage[] }>("/api/pages");
  return pages;
}

export async function fetchPage(id: string): Promise<CmsPage> {
  const { page } = await request<{ page: CmsPage }>(`/api/pages/${id}`);
  return page;
}

export async function createPageRequest(data: CmsPageFormData): Promise<CmsPage> {
  const { page } = await request<{ page: CmsPage }>("/api/pages", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return page;
}

export async function updatePageRequest(
  id: string,
  patch: Partial<CmsPageFormData>
): Promise<CmsPage> {
  const { page } = await request<{ page: CmsPage }>(`/api/pages/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
  return page;
}

export async function deletePageRequest(id: string): Promise<void> {
  await request<{ ok: true }>(`/api/pages/${id}`, { method: "DELETE" });
}
