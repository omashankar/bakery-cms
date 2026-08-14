import { requireRole } from "@/lib/server/auth/dal";

/**
 * Is this request allowed to see the unpublished draft?
 *
 * `/store?cmsPreview=1` and `/store/wedding-cakes?cmsPreview=wedding` rendered
 * the draft to anybody who put the parameter on the URL. There was no session
 * check anywhere in the path — and a preview link is opened with `window.open`
 * in an ordinary tab, so it is exactly the sort of URL that gets pasted into a
 * chat. Unreleased prices, an unannounced campaign and a half-built layout were
 * one query string away, and `generateMetadata` returns the same metadata for
 * the preview URL, so a leaked link is indexable.
 *
 * A visitor who guesses the parameter now simply gets the live page.
 */
export async function canPreviewDraft(): Promise<boolean> {
  try {
    await requireRole("owner", "admin");
    return true;
  } catch {
    return false;
  }
}
