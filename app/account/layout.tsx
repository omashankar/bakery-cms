import { StorefrontLayoutShell } from "@/layouts/storefront-layout";
import { AppearanceStyleTag } from "@/components/shared/appearance-style-tag";
import { getStorefrontScripts } from "@/features/settings/server/storefront-scripts.server";
import { getSeoStoreServer } from "@/features/seo/server/seo-store.server";
import { MaintenanceScreen } from "@/apps/website/components/maintenance-screen";
import { getStorefrontChrome } from "@/apps/website/lib/storefront-chrome.server";
import { getMaintenanceState } from "@/features/settings/server/maintenance.server";
import { getPublicContent } from "@/features/content/server/content.service";
import type { Banner } from "@/types/media";

export default async function AccountLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The customer account area is part of the shop, so it closes with it —
  // otherwise "the store is closed" still left order history, saved addresses
  // and the wishlist reachable at a different URL.
  const maintenance = await getMaintenanceState();
  // The promo strip's banners are read HERE, with the rest of the chrome,
  // because the strip used to fetch them in the browser and appear 450ms
  // late -- a 52px bar arriving above the header and shoving the whole page
  // down. getPublicContent returns the live ones only, so the schedule is
  // already settled and the client never has to re-check the clock.
  const [chrome, scripts, seo, bannerStrip] = await Promise.all([
    getStorefrontChrome(),
    getStorefrontScripts(),
    getSeoStoreServer(),
    getPublicContent("banners") as Promise<Banner[]>,
  ]);

  if (maintenance.isClosed) {
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

  return (
    <StorefrontLayoutShell
      chrome={chrome}
      bannerStrip={bannerStrip}
      scripts={scripts}
      organizationSchema={seo.global.organizationSchemaJson}
      maintenance={maintenance}
    >
      {children}
    </StorefrontLayoutShell>
  );
}
