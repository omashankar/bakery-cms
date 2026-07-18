import { LandingFooter } from "@/apps/website/landing/components/landing-footer";
import { MaintenanceBanner } from "@/apps/website/components/maintenance-banner";
import { StorefrontBannerStrip } from "@/apps/website/components/storefront-banner-strip";
import { StorefrontNavbar } from "@/apps/website/components/storefront-navbar";
import { cn } from "@/lib/utils";

interface StorefrontLayoutShellProps {
  children: React.ReactNode;
  className?: string;
}

/** Public bakery website — always light; never follows admin dark mode. */
export function StorefrontLayoutShell({
  children,
  className,
}: StorefrontLayoutShellProps) {
  return (
    <div
      className={cn("flex min-h-screen flex-col bg-white text-foreground", className)}
      data-storefront-theme="light"
      style={{ colorScheme: "light" }}
    >
      <div className="contents print:hidden">
        <MaintenanceBanner />
        <StorefrontBannerStrip />
        <StorefrontNavbar />
      </div>
      <main className="flex-1">{children}</main>
      <div className="print:hidden">
        <LandingFooter />
      </div>
    </div>
  );
}
