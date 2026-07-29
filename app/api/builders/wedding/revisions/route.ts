import { NextResponse } from "next/server";

import {
  listWeddingRevisions,
  restoreWeddingRevision,
} from "@/features/cms-sections/data/wedding-sections.server";
import { requireAdminResponse } from "@/lib/server/auth/guard";

/**
 * Wedding builder revision history — mirrors /api/builders/homepage/revisions.
 *
 * GET  — list the publish snapshots (newest first).
 * POST — restore a revision's sections into the draft ({ revisionId }).
 *
 * Both are owner/admin-only builder-internal data.
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
    return NextResponse.json({ revisions: await listWeddingRevisions() });
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
    const snapshot = await restoreWeddingRevision(body.revisionId);
    if (!snapshot) {
      return NextResponse.json({ error: "Revision not found" }, { status: 404 });
    }
    return NextResponse.json({ snapshot });
  } catch {
    return NextResponse.json({ error: "Failed to restore revision" }, { status: 500 });
  }
}
