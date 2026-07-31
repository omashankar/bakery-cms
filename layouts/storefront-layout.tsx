import { LandingFooter } from "@/apps/website/landing/components/landing-footer";
import { MaintenanceBanner } from "@/apps/website/components/maintenance-banner";
import { StorefrontBannerStrip } from "@/apps/website/components/storefront-banner-strip";
import { StorefrontNavbar } from "@/apps/website/components/storefront-navbar";
import type { StorefrontChrome } from "@/apps/website/lib/storefront-chrome.server";
import type { MaintenanceState } from "@/features/settings/server/maintenance.server";
import { cn } from "@/lib/utils";

interface StorefrontLayoutShellProps {
  children: React.ReactNode;
  className?: string;
  /** Navbar + footer data read from MongoDB on the server. */
  chrome: StorefrontChrome;
  /**
   * Read on the server. Only reaches here when the viewer is EXEMPT — a closed
   * shop is replaced by the maintenance screen before this renders.
   */
  maintenance: MaintenanceState;
}

/** Public bakery website — always light; never follows admin dark mode. */
export function StorefrontLayoutShell({
  children,
  className,
  chrome,
  maintenance,
}: StorefrontLayoutShellProps) {
  return (
    <div
      className={cn("flex min-h-screen flex-col bg-white text-foreground", className)}
      data-storefront-theme="light"
      style={{ colorScheme: "light" }}
    >
      <div className="contents print:hidden">
        <MaintenanceBanner maintenance={maintenance} />
        <StorefrontBannerStrip />
        <StorefrontNavbar chrome={chrome} />
      </div>
      <main className="flex-1">{children}</main>
      <div className="print:hidden">
        <LandingFooter chrome={chrome} />
      </div>
    </div>
  );
}
