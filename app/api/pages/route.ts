import { NextResponse } from "next/server";

import { createPage, getPages } from "@/features/content/data/pages.server";
import type { CmsPageFormData } from "@/types/content";

/** CMS page collection endpoint — the admin editor reads and writes here. */

export async function GET() {
  try {
    return NextResponse.json({ pages: await getPages() });
  } catch {
    return NextResponse.json({ error: "Failed to load pages" }, { status: 500 });
  }
}

export async function POST(request: Request) {
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
