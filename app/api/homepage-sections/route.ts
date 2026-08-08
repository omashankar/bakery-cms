import { NextResponse } from "next/server";

import {
  getHomepageState,
  publishSections,
  resetHomepageSections,
  saveDraftSections,
} from "@/features/cms-sections/data/homepage-sections.server";
import { BuilderConflictError } from "@/features/cms-sections/lib/builder-conflict";
import { parseSectionsPayload } from "@/features/cms-sections/lib/section-payload";
import { requireAdminResponse } from "@/lib/server/auth/guard";
import type { HomepageSectionInstance } from "@/types/homepage-builder";

/**
 * Homepage builder endpoint — owner/admin only, on every verb.
 *
 * The builder is a client app, so it saves through here. The storefront renders
 * on the server and reads the store directly — no HTTP hop needed.
 *
 * That last sentence is exactly why the GET is guarded. It used to be open,
 * justified as storefront data, but the storefront never calls it: it calls
 * `getHomepageState()` in-process. The only caller of this URL is the admin
 * builder. What an anonymous `curl` got back was `state.draft` — every headline,
 * image and price the admin was still working on, plus `draft.scheduledPublishAt`,
 * the exact minute an unannounced campaign was set to go live — and, once the
 * shop had published once, the inline `revisions` log with it. The sibling route
 * at /api/builders/homepage/revisions had already reasoned about this and
 * guarded its own read, noting that unlike this one it was "builder-internal
 * data, not storefront copy". A draft is not storefront copy either.
 */

interface SectionsBody {
  sections?: HomepageSectionInstance[];
  scheduledPublishAt?: string | null;
  action?: "publish" | "reset";
  /** The version the builder read on load — see builder-conflict.ts. */
  expectedVersion?: number;
}

/**
 * A save composed against a state that has since moved on.
 *
 * Answered 409 rather than 200-with-a-silent-overwrite, and carries the current
 * version so the client can say what happened instead of guessing.
 */
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
    return NextResponse.json({ state: await getHomepageState() });
  } catch {
    return NextResponse.json({ error: "Failed to load homepage sections" }, { status: 500 });
  }
}

/** Save the draft. */
export async function PUT(request: Request) {
  const auth = await requireAdminResponse();
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  // Shape-checked before it reaches the store: the storefront renders these
  // on the server, so a malformed section is a 500 on the live page.
  const parsed = parseSectionsPayload<HomepageSectionInstance>(body.sections);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const { snapshot, version } = await saveDraftSections(
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

/** Publish the given sections, or reset the homepage to registry defaults. */
export async function POST(request: Request) {
  const auth = await requireAdminResponse();
  if (auth instanceof NextResponse) return auth;

  const body = await parseBody(request);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    if (body.action === "reset") {
      return NextResponse.json({ state: await resetHomepageSections() });
    }

    const parsed = parseSectionsPayload<HomepageSectionInstance>(body.sections);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { snapshot, version } = await publishSections(
      parsed.sections,
      body.expectedVersion,
    );
    return NextResponse.json({ snapshot, version });
  } catch (error) {
    if (error instanceof BuilderConflictError) return conflict(error);
    return NextResponse.json({ error: "Failed to publish" }, { status: 500 });
  }
}
