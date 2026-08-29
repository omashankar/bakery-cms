import { NextResponse } from "next/server";

import { getHomepageRenderData } from "@/apps/website/lib/homepage-render-data.server";
import { requireAdminResponse } from "@/lib/server/auth/guard";

/**
 * Everything the homepage builder's PREVIEW needs, computed exactly the way the
 * live storefront computes it.
 *
 * The preview calls itself "the same light sections as live store" and was not.
 * The storefront passes nine server-computed props to the section renderer; the
 * builder passed three, and the renderer fell back to browser-side sources for
 * the rest. Those fallbacks read the shipped demo catalogue, so a shop with four
 * cakes previewed six product grids largely filled with cakes it does not sell,
 * then published a homepage nobody had actually seen.
 *
 * Rather than making each fallback more faithful — six of them, drifting
 * separately — the builder now fetches the storefront's own answer. There is one
 * function, and both surfaces call it.
 *
 * Owner/admin-only, like the revisions route beside it: this is builder-internal
 * data. It is also unfiltered in the sense that matters — it is the PUBLIC view,
 * so nothing here is more privileged than the storefront already serves.
 */
export async function GET() {
  const auth = await requireAdminResponse();
  if (auth instanceof NextResponse) return auth;

  try {
    return NextResponse.json(await getHomepageRenderData());
  } catch {
    return NextResponse.json({ error: "Failed to load preview data" }, { status: 500 });
  }
}
