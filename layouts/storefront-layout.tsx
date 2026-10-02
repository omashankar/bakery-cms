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
import type { Banner } from "@/types/media";

interface StorefrontLayoutShellProps {
  children: React.ReactNode;
  className?: string;
  /** Navbar + footer data read from MongoDB on the server. */
  chrome: StorefrontChrome;
  /**
   * The live promo banners, read on the server for the same reason the rest
   * of this shell's data is.
   *
   * The strip used to fetch its own in the browser and render nothing until
   * that landed, so a 52px bar appeared above the header about 450ms after
   * the page had painted and pushed everything down with it. Measured on the
   * production build: CLS 0.306 on the homepage and 0.545 on the wishlist,
   * against a 0.1 budget, while LCP was under 700ms -- the shop was not
   * slow, it moved.
   *
   * Every LIVE hero banner, not the ones for this route: which banners a
   * route may show depends on the path, and a server shell does not know
   * which page is rendering. The strip narrows the list itself.
   */
  bannerStrip: Banner[];
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
  bannerStrip,
  scripts,
  organizationSchema,
  maintenance,
}: StorefrontLayoutShellProps) {
  return (
    <div
      className={cn("flex min-h-screen flex-col bg-background text-foreground", className)}
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
        {/* The same banners the homepage's Promo Banner section draws, above
            the header instead. A shop that wants them in one place only can
            switch this off; see HeaderSettings.showBannerStrip. */}
        {chrome.showBannerStrip ? <StorefrontBannerStrip live={bannerStrip} /> : null}
        <StorefrontNavbar chrome={chrome} />
      </div>
      {/*
        A FLOOR UNDER main, SO THE FOOTER IS NOT ON SCREEN WHILE THE PAGE
        IS STILL ARRIVING.

        `min-h-screen` on the wrapper with `flex-1` here is the usual way
        to hold a footer at the bottom of a short page, and it cannot work
        for this footer: it is 946px tall on a phone, taller than the
        viewport by itself, so the wrapper is never stretched and `flex-1`
        never has spare height to take. The footer lands wherever the
        content ends — about 770px down a 900px screen while a page is
        still loading.

        Then the content lands and the footer moves, and being nearly a
        screen tall it drags a lot of pixels through the viewport.
        Measured on the production build at 390x900:

                        before   after
          home           0.138       0
          wishlist       0.433       0
          cart           0.114       0

        At 1440x900, home 0.218 -> 0 and wishlist 0.169 -> 0, against a
        0.1 budget. The homepage shifts because its skeleton is 660px and
        its content 3705px; the cart and wishlist shift the OTHER way,
        because their contents live in the browser and the skeleton is
        taller than the empty state replacing it. One floor fixes both,
        because what it removes is not the height change but the footer's
        presence on screen during it.

        Every other storefront page measured 0 before and 0 after. A floor
        set too high is its own bug — it would push a short page's footer
        down instead — so privacy, terms, faq, contact and the listing page
        were measured too. 75svh leaves 0.121 on the wishlist.

        `svh`, not `dvh`: the dynamic unit changes as a phone's address bar
        hides, which is a resize of the very box this exists to hold still.

        `print:min-h-0` because the invoice route renders inside this shell
        and a screen-height main adds a blank page to it — the same pattern
        as layouts/admin-layout.tsx.
      */}
      <main className="min-h-svh flex-1 print:min-h-0">{children}</main>
      <div className="print:hidden">
        <LandingFooter chrome={chrome} />
      </div>
    </div>
  );
}
