import type { Metadata } from "next";
import { getSeoStoreServer } from "@/features/seo/server/seo-store.server";
import { Inter, Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import { ThemeBlockingScript } from "@/components/theme-blocking-script";
import { BusinessBlockingScript } from "@/components/business-blocking-script";
import { LocaleSync } from "@/components/shared/locale-sync";
import { getSiteIdentity } from "@/features/settings/server/site-identity.server";
import { setActiveLocale } from "@/features/settings/lib/active-locale";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/**
 * The tab title, description and favicon come from General settings.
 *
 * They were hard-coded to "Bakery CMS" and `app/favicon.ico`, so a shop that
 * renamed itself in the admin still had someone else's name in every browser
 * tab and bookmark — and the favicon field saved to the database and was read
 * by nothing at all. The icon file moved to `public/` for this: file-based
 * metadata (`app/favicon.ico`) outranks anything set here, so while it existed
 * the configured favicon could never win.
 */
export async function generateMetadata(): Promise<Metadata> {
  const [{ siteName, siteDescription, favicon }, seo] = await Promise.all([
    getSiteIdentity(),
    getSeoStoreServer(),
  ]);

  const googleSiteVerification = seo.global.googleSiteVerification?.trim();

  return {
    title: { default: siteName, template: `%s | ${siteName}` },
    description: siteDescription,
    icons: { icon: favicon },
    // The SEO screen has a plainly labelled "Google site verification" field,
    // saved with "Global SEO settings saved" and read by nothing — so a shop
    // pasting the token Search Console gave them stayed unverified.
    verification: googleSiteVerification ? { google: googleSiteVerification } : undefined,
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { currency, timezone, resolved } = await getSiteIdentity();

  // Publishes the store's currency and timezone to the RSC render. `LocaleSync`
  // below does the same for client components, which are rendered from a
  // separate module graph and would otherwise format with the fallback — see
  // `features/settings/lib/active-locale.ts`.
  //
  // Only when the read actually succeeded. That value is module-level and
  // shared by every render in the process, so publishing the built-in defaults
  // from one request that hit a database blip would reprice a USD shop in
  // rupees for whatever other requests were mid-render.
  if (resolved) setActiveLocale(currency, timezone);

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${plusJakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        {/*
          Only on a RESOLVED read. `setActiveLocale` above is already gated on
          it — the flag exists so a database blip cannot repaint a USD shop in
          rupees — and this second publisher, which writes the same values into
          the CLIENT module graph, was not. One request that failed its settings
          read therefore repriced the product cards, the cart, the checkout
          total and the order summary for that visitor.
        */}
        {resolved ? <LocaleSync currency={currency} timezone={timezone} /> : null}
        <ThemeBlockingScript />
        <BusinessBlockingScript />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
