import { NextResponse } from "next/server";

import {
  getWeddingState,
  publishWeddingSections,
  resetWeddingSections,
  saveWeddingDraft,
} from "@/features/cms-sections/data/wedding-sections.server";
import type { WeddingSectionInstance } from "@/types/wedding-builder";

/** Wedding builder endpoint — mirrors /api/homepage-sections. */

interface SectionsBody {
  sections?: WeddingSectionInstance[];
  scheduledPublishAt?: string | null;
  action?: "publish" | "reset";
}

async function parseBody(request: Request): Promise<SectionsBody | null> {
  try {
    return (await request.json()) as SectionsBody;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    return NextResponse.json({ state: await getWeddingState() });
  } catch {
    return NextResponse.json({ error: "Failed to load wedding sections" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const body = await parseBody(request);
  if (!body || !Array.isArray(body.sections)) {
    return NextResponse.json({ error: "sections array is required" }, { status: 400 });
  }

  try {
    return NextResponse.json({
      snapshot: await saveWeddingDraft(body.sections, body.scheduledPublishAt),
    });
  } catch {
    return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const body = await parseBody(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    if (body.action === "reset") {
      return NextResponse.json({ state: await resetWeddingSections() });
    }

    if (!Array.isArray(body.sections)) {
      return NextResponse.json({ error: "sections array is required" }, { status: 400 });
    }

    return NextResponse.json({ snapshot: await publishWeddingSections(body.sections) });
  } catch {
    return NextResponse.json({ error: "Failed to publish" }, { status: 500 });
  }
}
