import { can, getActor } from "@/lib/server/auth/access";
import type { Permission } from "@/features/team/lib/permissions";

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
 * A visitor who guesses the parameter now simply gets the live page — and so
 * does a team member who could not open that draft in the admin either. The
 * session lookup only happens when the preview parameter is present.
 */
export async function canPreviewDraft(permission: Permission): Promise<boolean> {
  try {
    return can(await getActor(), permission);
  } catch {
    return false;
  }
}
