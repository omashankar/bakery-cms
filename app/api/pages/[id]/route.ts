import { NextResponse } from "next/server";

import { deletePage, getPageById, updatePage } from "@/features/content/data/pages.server";
import type { CmsPageFormData } from "@/types/content";

/** Next 16 delivers dynamic route params as a Promise — await before use. */
interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const page = await getPageById(id);
    if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });
    return NextResponse.json({ page });
  } catch {
    return NextResponse.json({ error: "Failed to load page" }, { status: 500 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const { id } = await context.params;

  let body: Partial<CmsPageFormData>;
  try {
    body = (await request.json()) as Partial<CmsPageFormData>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const updated = await updatePage(id, body);
    if (!updated) return NextResponse.json({ error: "Page not found" }, { status: 404 });
    return NextResponse.json({ page: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update page" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const removed = await deletePage(id);
    if (!removed) return NextResponse.json({ error: "Page not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete page" }, { status: 500 });
  }
}
