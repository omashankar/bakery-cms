import { StorefrontLayoutShell } from "@/layouts/storefront-layout";
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
    return <MaintenanceScreen siteName={chrome.siteName} message={maintenance.message} />;
  }

  return (
    <StorefrontLayoutShell chrome={chrome} maintenance={maintenance}>
      {children}
    </StorefrontLayoutShell>
  );
}
