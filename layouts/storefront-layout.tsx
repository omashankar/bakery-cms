import { LandingFooter } from "@/features/landing/components/landing-footer";
import { MaintenanceBanner } from "@/features/storefront/components/maintenance-banner";
import { StorefrontBannerStrip } from "@/features/storefront/components/storefront-banner-strip";
import { StorefrontNavbar } from "@/features/storefront/components/storefront-navbar";
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
      <MaintenanceBanner />
      <StorefrontBannerStrip />
      <StorefrontNavbar />
      <main className="flex-1">{children}</main>
      <LandingFooter />
    </div>
  );
}
