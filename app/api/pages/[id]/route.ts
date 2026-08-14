import { NextResponse } from "next/server";

import {
  deletePage,
  getPageById,
  getPages,
  updatePage,
} from "@/features/content/data/pages.server";
import { requireAdminResponse } from "@/lib/server/auth/guard";
import type { CmsPageFormData } from "@/types/content";

/** Next 16 delivers dynamic route params as a Promise — await before use. */
interface RouteContext {
  params: Promise<{ id: string }>;
}

/** Owner/admin only on every verb — see the collection route for why the read too. */
export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireAdminResponse();
  if (auth instanceof NextResponse) return auth;

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
  const auth = await requireAdminResponse();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;

  let body: Partial<CmsPageFormData>;
  try {
    body = (await request.json()) as Partial<CmsPageFormData>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    // The same uniqueness rule POST enforces.
    //
    // Only the create path checked it, so an admin could open any page, retype
    // its slug as "about", and save. Every storefront lookup is a `.find()` over
    // the array and new pages are prepended, so the newer record won: /store/about
    // served the other page's body under the About Us route, and nothing in the
    // admin showed two pages sharing a slug.
    if (typeof body.slug === "string" && body.slug.trim()) {
      const slug = body.slug.trim();
      const clash = (await getPages()).find((page) => page.slug === slug && page.id !== id);
      if (clash) {
        return NextResponse.json({ error: "That slug is already in use" }, { status: 409 });
      }
    }

    const updated = await updatePage(id, body);
    if (!updated) return NextResponse.json({ error: "Page not found" }, { status: 404 });
    return NextResponse.json({ page: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update page" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const auth = await requireAdminResponse();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  try {
    // "System pages cannot be removed" was enforced only in the browser — the
    // dialog hid the button and the list filtered them out of a bulk selection.
    // The route deleted any id, so About Us, Privacy Policy and Terms of Service
    // could all be removed by a scripted call or a stale admin tool, leaving
    // /store/about, /store/privacy and /store/terms with nothing behind them.
    const page = await getPageById(id);
    if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });
    if (page.isSystem) {
      return NextResponse.json(
        { error: "System pages cannot be removed" },
        { status: 403 },
      );
    }

    const removed = await deletePage(id);
    if (!removed) return NextResponse.json({ error: "Page not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete page" }, { status: 500 });
  }
}
