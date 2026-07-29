import { NextResponse } from "next/server";

import {
  listHomepageRevisions,
  restoreHomepageRevision,
} from "@/features/cms-sections/data/homepage-sections.server";
import { requireAdminResponse } from "@/lib/server/auth/guard";

/**
 * Homepage builder revision history.
 *
 * GET  — list the publish snapshots (newest first).
 * POST — restore a revision's sections into the draft ({ revisionId }).
 *
 * Both are owner/admin-only: this is builder-internal data, not storefront copy,
 * so unlike /api/homepage-sections the read is guarded too.
 */

interface RestoreBody {
  revisionId?: string;
}

async function parseBody(request: Request): Promise<RestoreBody | null> {
  try {
    return (await request.json()) as RestoreBody;
  } catch {
    return null;
  }
}

export async function GET() {
  const auth = await requireAdminResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    return NextResponse.json({ revisions: await listHomepageRevisions() });
  } catch {
    return NextResponse.json({ error: "Failed to load revisions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminResponse();
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(request);
  if (!body || typeof body.revisionId !== "string") {
    return NextResponse.json({ error: "revisionId is required" }, { status: 400 });
  }

  try {
    const snapshot = await restoreHomepageRevision(body.revisionId);
    if (!snapshot) {
      return NextResponse.json({ error: "Revision not found" }, { status: 404 });
    }
    return NextResponse.json({ snapshot });
  } catch {
    return NextResponse.json({ error: "Failed to restore revision" }, { status: 500 });
  }
}
