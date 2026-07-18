import { NextResponse } from "next/server";

import {
  getHomepageState,
  publishSections,
  resetHomepageSections,
  saveDraftSections,
} from "@/features/cms-sections/data/homepage-sections.server";
import type { HomepageSectionInstance } from "@/types/homepage-builder";

/**
 * Homepage builder endpoint.
 *
 * The builder is a client app, so it saves through here. The storefront renders
 * on the server and reads the store directly — no HTTP hop needed.
 */

interface SectionsBody {
  sections?: HomepageSectionInstance[];
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
    return NextResponse.json({ state: await getHomepageState() });
  } catch {
    return NextResponse.json({ error: "Failed to load homepage sections" }, { status: 500 });
  }
}

/** Save the draft. */
export async function PUT(request: Request) {
  const body = await parseBody(request);
  if (!body || !Array.isArray(body.sections)) {
    return NextResponse.json({ error: "sections array is required" }, { status: 400 });
  }

  try {
    const snapshot = await saveDraftSections(body.sections, body.scheduledPublishAt);
    return NextResponse.json({ snapshot });
  } catch {
    return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
  }
}

/** Publish the given sections, or reset the homepage to registry defaults. */
export async function POST(request: Request) {
  const body = await parseBody(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    if (body.action === "reset") {
      return NextResponse.json({ state: await resetHomepageSections() });
    }

    if (!Array.isArray(body.sections)) {
      return NextResponse.json({ error: "sections array is required" }, { status: 400 });
    }

    return NextResponse.json({ snapshot: await publishSections(body.sections) });
  } catch {
    return NextResponse.json({ error: "Failed to publish" }, { status: 500 });
  }
}
