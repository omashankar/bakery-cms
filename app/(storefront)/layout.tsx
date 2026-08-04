import { StorefrontLayoutShell } from "@/layouts/storefront-layout";
import { AppearanceStyleTag } from "@/components/shared/appearance-style-tag";
import { getStorefrontScripts } from "@/features/settings/server/storefront-scripts.server";
import { getSeoStoreServer } from "@/features/seo/server/seo-store.server";
import { MaintenanceScreen } from "@/apps/website/components/maintenance-screen";
import { getStorefrontChrome } from "@/apps/website/lib/storefront-chrome.server";
import { getMaintenanceState } from "@/features/settings/server/maintenance.server";

/**
 * KNOWN GAP: a closed storefront answers 200, not 503.
 *
 * 503 + `Retry-After` is the signal for temporary downtime — it keeps a URL's
 * existing index entry and tells uptime checks the site is down. A layout cannot
 * set a status code; the one place that can is `proxy.ts`, which this project
 * deliberately keeps free of database work because it runs on every request
 * including prefetches.
 *
 * `robots: noindex` was the first attempt and is worse than nothing here: 200 +
 * noindex is the documented request to REMOVE a URL from the index, so a crawl
 * during a short maintenance window would drop pages that are about to come
 * back. Left off on purpose. If maintenance windows become long enough for the
 * crawl to matter, the fix is a status code, not a meta tag.
 */
export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Maintenance mode replaces the storefront here rather than adding a banner to
  // it. The switch says "take the storefront offline"; before this it rendered a
  // yellow strip and left the shop selling, so a customer could complete an
  // order against a store the admin believed was closed.
  const maintenance = await getMaintenanceState();
  if (maintenance.isClosed) {
    const chrome = await getStorefrontChrome();
    // The maintenance screen IS the storefront while the shop is closed, and
    // it renders outside the shell — so it was the one customer-facing page
    // still painting the demo palette on its first paint.
    return (
      <div style={{ colorScheme: "light", ...chrome.appearance } as React.CSSProperties}>
        <AppearanceStyleTag tokens={chrome.appearance} />
        <MaintenanceScreen siteName={chrome.siteName} message={maintenance.message} />
      </div>
    );
  }

  // Read navbar + footer data from MongoDB on the server so the store name, nav,
  // contact and footer render real in the HTML (no defaults-then-hydrate flash).
  const [chrome, scripts, seo] = await Promise.all([
    getStorefrontChrome(),
    getStorefrontScripts(),
    getSeoStoreServer(),
  ]);
  return (
    <StorefrontLayoutShell
      chrome={chrome}
      scripts={scripts}
      organizationSchema={seo.global.organizationSchemaJson}
      maintenance={maintenance}
    >
      {children}
    </StorefrontLayoutShell>
  );
}
