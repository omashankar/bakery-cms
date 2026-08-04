import { LandingFooter } from "@/apps/website/landing/components/landing-footer";
import { MaintenanceBanner } from "@/apps/website/components/maintenance-banner";
import { StorefrontBannerStrip } from "@/apps/website/components/storefront-banner-strip";
import { StorefrontNavbar } from "@/apps/website/components/storefront-navbar";
import type { StorefrontChrome } from "@/apps/website/lib/storefront-chrome.server";
import type { MaintenanceState } from "@/features/settings/server/maintenance.server";
import { AppearanceStyleTag } from "@/components/shared/appearance-style-tag";
import { StorefrontScriptTags } from "@/components/shared/storefront-scripts";
import type { StorefrontScripts } from "@/features/settings/server/storefront-scripts.server";
import { cn } from "@/lib/utils";

interface StorefrontLayoutShellProps {
  children: React.ReactNode;
  className?: string;
  /** Navbar + footer data read from MongoDB on the server. */
  chrome: StorefrontChrome;
  /**
   * Analytics tags and custom code, read on the server.
   *
   * Both screens stored these, validated them and summarised them, and
   * nothing emitted them — there was no next/script import in the repo.
   */
  scripts: StorefrontScripts;
  /**
   * The organisation JSON-LD from the SEO screen.
   *
   * That field is validated on the admin side and BLOCKS the whole section's
   * Save when the JSON is malformed — a gate on a value nothing emitted. A
   * shop could not save its SEO settings because of a stray comma in a script
   * no search engine was ever shown.
   */
  organizationSchema?: string;
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
  scripts,
  organizationSchema,
  maintenance,
}: StorefrontLayoutShellProps) {
  return (
    <div
      className={cn("flex min-h-screen flex-col bg-white text-foreground", className)}
      data-storefront-theme="light"
      /*
        The shop's palette in the FIRST paint.
        Nothing server-rendered it, so every visitor got the hardcoded defaults
        from globals.css until a client fetch resolved and repainted — invisible
        to a shop on the default palette, and a flash of demo brown on every
        cold load for any shop that had picked its own colours. Spread AFTER
        colorScheme so an empty map (unreadable stored palette, or a database
        outage) simply leaves the stylesheet defaults standing.
      */
      style={{ colorScheme: "light", ...chrome.appearance } as React.CSSProperties}
    >
      {/*
        And on :root, for everything that escapes this div.
        Sonner's toaster and every Base UI popup render through a PORTAL on
        document.body, so they read the tokens from :root — which only the
        client wrote. Those surfaces painted the stylesheet defaults until a
        fetch landed, and stayed that way for the session if it failed.
      */}
      <AppearanceStyleTag tokens={chrome.appearance} />
      <StorefrontScriptTags scripts={scripts} />
      {organizationSchema?.trim() ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: organizationSchema }}
        />
      ) : null}
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
