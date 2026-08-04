import Script from "next/script";
import type { StorefrontScripts } from "@/features/settings/server/storefront-scripts.server";

/**
 * The analytics tags and custom code the admin configured.
 *
 * Rendered on the STOREFRONT only. The admin is a different tree and must not
 * run a shop's own JavaScript: an admin session can read orders, customers and
 * settings, and a script written for the storefront has no business in it.
 *
 * `afterInteractive` for the loaders, so a slow third party cannot hold up the
 * page — but the tags are in the server-rendered HTML either way, which is the
 * part that was missing. Nothing at all is emitted for an unset id.
 */
export function StorefrontScriptTags({ scripts }: { scripts: StorefrontScripts }) {
  const { analytics, customCss, customJs } = scripts;

  return (
    <>
      {analytics.googleTagManagerId ? (
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${analytics.googleTagManagerId}');`}
        </Script>
      ) : null}

      {analytics.googleAnalyticsId ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${analytics.googleAnalyticsId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${analytics.googleAnalyticsId}');`}
          </Script>
        </>
      ) : null}

      {analytics.facebookPixelId ? (
        <Script id="fb-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${analytics.facebookPixelId}');fbq('track','PageView');`}
        </Script>
      ) : null}

      {analytics.hotjarId ? (
        <Script id="hotjar" strategy="afterInteractive">
          {`(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${JSON.stringify(analytics.hotjarId)},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j;a.appendChild(r)})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');`}
        </Script>
      ) : null}

      {/*
        The shop's own CSS, in the HTML so it applies to the first paint rather
        than flashing in after hydration.
      */}
      {customCss.trim() ? (
        <style id="custom-code-css" dangerouslySetInnerHTML={{ __html: customCss }} />
      ) : null}

      {/*
        And its JavaScript. `afterInteractive` deliberately: this is arbitrary
        code an admin pasted, and running it before the page is usable would let
        a mistake in it block the shop from rendering at all.
      */}
      {customJs.trim() ? (
        <Script id="custom-code-js" strategy="afterInteractive">
          {customJs}
        </Script>
      ) : null}
    </>
  );
}
