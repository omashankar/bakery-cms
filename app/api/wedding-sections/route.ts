import { NextResponse } from "next/server";

import {
  getWeddingState,
  publishWeddingSections,
  resetWeddingSections,
  saveWeddingDraft,
} from "@/features/cms-sections/data/wedding-sections.server";
import { BuilderConflictError } from "@/features/cms-sections/lib/builder-conflict";
import { parseSectionsPayload } from "@/features/cms-sections/lib/section-payload";
import { requireAdminResponse } from "@/lib/server/auth/guard";
import type { WeddingSectionInstance } from "@/types/wedding-builder";

/**
 * Wedding builder endpoint — mirrors /api/homepage-sections, owner/admin only on
 * every verb including the read. See that file for why the GET is guarded: the
 * storefront reads the store in-process and never calls this URL, so the open
 * read only ever served the unpublished draft to anonymous callers.
 */

interface SectionsBody {
  sections?: WeddingSectionInstance[];
  scheduledPublishAt?: string | null;
  action?: "publish" | "reset";
  /** The version the builder read on load — see builder-conflict.ts. */
  expectedVersion?: number;
}

/** A save composed against a state that has since moved on — see the homepage route. */
function conflict(error: BuilderConflictError) {
  return NextResponse.json(
    { error: error.message, currentVersion: error.currentVersion },
    { status: 409 },
  );
}

async function parseBody(request: Request): Promise<SectionsBody | null> {
  try {
    return (await request.json()) as SectionsBody;
  } catch {
    return null;
  }
}

export async function GET() {
  const auth = await requireAdminResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    return NextResponse.json({ state: await getWeddingState() });
  } catch {
    return NextResponse.json({ error: "Failed to load wedding sections" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await requireAdminResponse();
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  // Shape-checked before it reaches the store: the storefront renders these
  // on the server, so a malformed section is a 500 on the live page.
  const parsed = parseSectionsPayload<WeddingSectionInstance>(body.sections);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const { snapshot, version } = await saveWeddingDraft(
      parsed.sections,
      body.scheduledPublishAt,
      body.expectedVersion,
    );
    return NextResponse.json({ snapshot, version });
  } catch (error) {
    if (error instanceof BuilderConflictError) return conflict(error);
    return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdminResponse();
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    if (body.action === "reset") {
      return NextResponse.json({ state: await resetWeddingSections() });
    }

    const parsed = parseSectionsPayload<WeddingSectionInstance>(body.sections);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { snapshot, version } = await publishWeddingSections(
      parsed.sections,
      body.expectedVersion,
    );
    return NextResponse.json({ snapshot, version });
  } catch (error) {
    if (error instanceof BuilderConflictError) return conflict(error);
    return NextResponse.json({ error: "Failed to publish" }, { status: 500 });
  }
}
