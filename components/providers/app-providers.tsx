"use client";

import { ThemeProvider } from "@/components/providers/theme-provider";
import { AppearanceThemeSync } from "@/components/shared/appearance-theme-sync";
import { SettingsServerSync } from "@/components/shared/settings-server-sync";
import { CatalogServerSync } from "@/components/shared/catalog-server-sync";
import { CommerceServerSync } from "@/components/shared/commerce-server-sync";
import { ContentServerSync } from "@/components/shared/content-server-sync";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider defaultTheme="light">
      <AppearanceThemeSync />
      {/*
        These four stay EAGER, and the attempt to defer them is worth recording.

        On the face of it they are a prefetch: every storefront route is
        server-rendered from the same documents, so the header, footer, palette,
        banners and FAQ are already in the HTML before this mounts. Deferring
        them to browser idle took eleven requests off the critical path of every
        customer page view — measured in a browser, /login 11 and /store 12 — and
        it was wrong.

        CHECKOUT PRICES FROM THESE CACHES. `revalidateCoupon` reaches
        `getCouponByCode`, which reads the local coupon copy synchronously, and
        the payment methods on offer come out of the settings copy the same way.
        Neither can await. So while a cache is unhydrated the browser answers
        from whatever it last held — or from the shipped seed on a cold load —
        and the page prices against that.

        The suite caught both: a coupon that had stopped qualifying went on
        reading as applied over a total that no longer contained its discount,
        and online payment stopped being offered at a checkout the shop had
        switched it on for. Those are wrong prices and a lost sale, which is not
        a trade worth eleven requests.

        The real fix is for checkout to await `ensureSettingsHydrated()` and its
        coupon equivalent before it prices anything — the pattern the admin forms
        already follow. That belongs in a change of its own, made against the
        checkout page deliberately, not as a side effect of a prefetch tweak.
      */}
      <SettingsServerSync />
      <CatalogServerSync />
      <CommerceServerSync />
      <ContentServerSync />
      {/*
        `SiteLayoutServerSync` is deliberately NOT here.

        It fetched /api/site-layout/header, /footer and /appearance, and all
        three are admin-only reads — verified against a running server, they
        answer 401 to an anonymous visitor. So on every customer page view they
        were three requests that could only ever be refused, and nothing on the
        storefront used their result: `AppearanceThemeSync` stands down while the
        server has already painted the palette and the hydration gate has not
        settled, which for a customer is always.

        The admin still gets them, from its own deferred hydration in
        `layouts/admin-layout.tsx`, and every admin screen that WRITES header,
        footer or appearance calls `ensureSiteLayoutHydrated()` itself first —
        which is what covers signing in through the login form and soft
        navigating in, the case this component was mounted globally for.
      */}
      <TooltipProvider delay={200}>
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            classNames: {
              toast: "font-sans",
            },
          }}
        />
      </TooltipProvider>
    </ThemeProvider>
  );
}
