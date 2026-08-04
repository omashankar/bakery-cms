import { StorefrontLayoutShell } from "@/layouts/storefront-layout";
import { AppearanceStyleTag } from "@/components/shared/appearance-style-tag";
import { MaintenanceScreen } from "@/apps/website/components/maintenance-screen";
import { getStorefrontChrome } from "@/apps/website/lib/storefront-chrome.server";
import { getMaintenanceState } from "@/features/settings/server/maintenance.server";

export default async function AccountLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The customer account area is part of the shop, so it closes with it —
  // otherwise "the store is closed" still left order history, saved addresses
  // and the wishlist reachable at a different URL.
  const maintenance = await getMaintenanceState();
  const chrome = await getStorefrontChrome();

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
    <StorefrontLayoutShell chrome={chrome} maintenance={maintenance}>
      {children}
    </StorefrontLayoutShell>
  );
}
