import { StoreNotFoundPage } from "@/apps/website";
import { AppearanceStyleTag } from "@/components/shared/appearance-style-tag";
import { getStorefrontChrome } from "@/apps/website/lib/storefront-chrome.server";

/**
 * The root 404 answers an unmatched URL, so it renders outside every layout —
 * including the storefront shell that carries the shop's palette. A mistyped or
 * stale link (`/store/valentines-2025`) therefore landed a customer on a page
 * painted in the demo colours. Reading the chrome costs one query on a page
 * nobody wants to be on, and makes it look like the same shop.
 *
 * What it used to render was worse than the wrong colours: `RoutePlaceholder`,
 * a BUILD-STATUS card. A customer following a dead link got a construction-cone
 * icon, a "Public Website" badge, a "Phase 4" badge, a `/404` path chip, and two
 * buttons — "Architecture Hub" and "Design System" — into the vendor's own
 * internal pages. Outside the storefront shell there is no navbar or footer to
 * leave by, so those buttons were the only way out of a shop's 404.
 *
 * It renders the storefront's own not-found page now, the same one
 * `/store/**` already used. `RoutePlaceholder` had exactly this one caller.
 */
export default async function NotFound() {
  const chrome = await getStorefrontChrome();

  return (
    <div
      className="flex min-h-screen flex-col"
      style={{ colorScheme: "light", ...chrome.appearance } as React.CSSProperties}
    >
      <AppearanceStyleTag tokens={chrome.appearance} />
      <StoreNotFoundPage />
    </div>
  );
}
