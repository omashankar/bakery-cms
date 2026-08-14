import { NextResponse } from "next/server";

import { createPage, getPages } from "@/features/content/data/pages.server";
import { requireAdminResponse } from "@/lib/server/auth/guard";
import type { CmsPageFormData } from "@/types/content";

/**
 * CMS page collection endpoint — the admin editor reads and writes here.
 *
 * Owner/admin only on every verb, the read included. It used to be open, and
 * `getPages` returns EVERY page whatever its status — so an anonymous `curl`
 * received the full body of every draft and archived page, its SEO fields and
 * its `scheduledPublishAt`, the exact minute of an unannounced launch. The
 * storefront never calls this: it reads the store in-process through
 * `getPageForStorefront`, which filters to published. proxy.ts excludes /api
 * from the route guard, so nothing upstream was compensating.
 */

export async function GET() {
  const auth = await requireAdminResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    return NextResponse.json({ pages: await getPages() });
  } catch {
    return NextResponse.json({ error: "Failed to load pages" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminResponse();
  if (auth instanceof NextResponse) return auth;

  let body: CmsPageFormData;
  try {
    body = (await request.json()) as CmsPageFormData;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.title?.trim() || !body?.slug?.trim()) {
    return NextResponse.json({ error: "Title and slug are required" }, { status: 400 });
  }

  try {
    const existing = await getPages();
    if (existing.some((page) => page.slug === body.slug)) {
      return NextResponse.json({ error: "That slug is already in use" }, { status: 409 });
    }
    return NextResponse.json({ page: await createPage(body) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create page" }, { status: 500 });
  }
}
