import type { NextConfig } from "next";

/**
 * The Cloudinary account this shop uploads to, from either supported form of
 * the credentials — `CLOUDINARY_URL` (cloudinary://key:secret@cloud) or the
 * separate vars. Matches how lib/server/media/cloudinary.ts reads them.
 */
function resolveCloudinaryCloudName(): string | undefined {
  const direct = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  if (direct) return direct;

  const url = process.env.CLOUDINARY_URL?.trim();
  if (!url) return undefined;
  try {
    return new URL(url).hostname || undefined;
  } catch {
    return undefined;
  }
}

const cloudinaryCloudName = resolveCloudinaryCloudName();

/**
 * Sent on every response. There were none at all before this.
 *
 * `frame-ancestors 'none'` and its older twin `X-Frame-Options: DENY` are the
 * ones that matter here: without them any site can put this admin panel in an
 * invisible iframe over its own buttons, so an owner who is signed in and
 * visits a malicious page can be clicked into issuing a refund, deleting the
 * catalogue or revoking a session without ever seeing what they pressed. The
 * panel has no re-authentication step on those actions, which is reasonable
 * for a shop and is exactly what makes the frame the whole attack.
 *
 * Applied to the STOREFRONT too, not only /admin. Next appends headers from
 * every matching rule, so two rules with different `X-Frame-Options` values
 * would send both and leave the browser to choose — and nothing in this app
 * frames its own pages (the only `<iframe>` is the Google map the contact page
 * embeds, which is this app framing someone else). If a shop ever needs its
 * storefront embedded, this is the line to relax, deliberately.
 *
 * Deliberately NOT a full Content-Security-Policy. `frame-ancestors` is the
 * only directive here, so nothing constrains what the page may LOAD: Razorpay's
 * checkout opens an iframe inside the page and pulls its own scripts, and a
 * `default-src` written without proving it out would break paying for a cake to
 * fix a lesser problem.
 */
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Stops a browser second-guessing a Content-Type — an uploaded file served as
  // one thing and sniffed as another is how a media library becomes a script
  // host.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // A full URL leaks order numbers and reset tokens into other sites' referer
  // logs; the origin alone is enough for anyone who needs it.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  /**
   * The browser features this app never asks for — and NOT `payment`.
   *
   * `payment=()` disables the Payment Request API, and this header propagates
   * into iframes: Razorpay's checkout runs in one, and that is the API behind
   * its Google Pay flow. Denying it here would break paying for a cake in order
   * to close a permission this app was never going to use anyway, which is the
   * same trade this file already refuses when it declines to write a
   * `default-src`.
   *
   * The three that remain are genuinely unused — nothing in the tree calls
   * `getUserMedia` or `navigator.geolocation`; the photo-cake upload is a file
   * input and delivery zones are decided from a typed pincode.
   */
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/**
 * HSTS, and ONLY in production.
 *
 * A browser that sees this header on localhost remembers it for the whole
 * max-age and then refuses to load http://localhost at all — for every other
 * project on the machine, not just this one, because the policy is stored per
 * host and localhost is one host. That is a genuinely painful thing to undo, so
 * the header is gated rather than set and forgotten.
 *
 * `preload` is included but submitting the domain to the preload list is a
 * separate, deliberate step — and close to irreversible, so it belongs to
 * whoever owns the domain, not to this file.
 */
const HSTS = {
  key: "Strict-Transport-Security",
  value: "max-age=63072000; includeSubDomains; preload",
};

const nextConfig: NextConfig = {
  // Mongoose is a large CommonJS package with dynamic requires — let Node load it
  // directly instead of bundling it into the server build (faster, avoids issues).
  serverExternalPackages: ["mongoose", "cloudinary"],
  // Nothing gains from telling every caller which framework and version this is.
  poweredByHeader: false,
  images: {
    /**
     * Every host `next/image` is allowed to fetch from. Anything else answers
     * 400 and renders as a blank box.
     *
     * `images.unsplash.com` alone was the whole list, which is the host the
     * SHIPPED DEMO catalogue uses. So the shop's own photographs — everything
     * uploaded through Media, which Cloudinary serves from `res.cloudinary.com`
     * — were refused by the optimiser, on the storefront and in the admin
     * previews alike. A bakery could replace every demo image with its own
     * cakes and end up with a storefront of empty rectangles.
     *
     * Scoped to the configured cloud rather than all of Cloudinary: the path is
     * `/<cloud-name>/image/upload/...`, and the docs warn that an unrestricted
     * pattern lets anyone route arbitrary images through this shop's optimiser.
     * Without a cloud name configured there is nothing to scope to and nothing
     * being uploaded either.
     */
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: cloudinaryCloudName ? `/${cloudinaryCloudName}/**` : "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers:
          process.env.NODE_ENV === "production"
            ? [...SECURITY_HEADERS, HSTS]
            : SECURITY_HEADERS,
      },
    ];
  },
  async redirects() {
    return [
      /**
       * The front door is the SHOP.
       *
       * `app/page.tsx` renders this product's own marketing page — "Bakery CMS
       * — Complete Bakery Business Management Platform", with a Pricing
       * section. That is the right page for whoever sells this software and
       * the wrong one for every shop running it: a customer arriving from
       * Instagram, a printed card or a search result met an advert for a
       * dashboard instead of the cakes. So did anyone following the shop's own
       * "Powered by Bakery CMS" footer link.
       *
       * Temporary (307), not permanent. A permanent redirect is cached by the
       * browser more or less forever, and this is a decision a deployment might
       * reasonably reverse — the vendor's own site wants that page at its root.
       * The page itself was not deleted — it moved to `/platform`, which is where
       * `/landing` now points too. A shop reselling this CMS still needs an
       * address to send a prospect to; it just must not be the one its own
       * customers type. `app/page.tsx` stays as the escape hatch for a
       * deployment that wants the vendor page back at the root.
       */
      { source: "/", destination: "/store", permanent: false },
      { source: "/landing", destination: "/platform", permanent: true },
      { source: "/admin/website", destination: "/admin/settings", permanent: true },
      { source: "/admin/website/homepage", destination: "/admin/builders/homepage", permanent: true },
      { source: "/admin/website/header", destination: "/admin/header", permanent: true },
      { source: "/admin/website/footer", destination: "/admin/footer", permanent: true },
      { source: "/admin/website/menu", destination: "/admin/header", permanent: true },
      { source: "/admin/website/pages", destination: "/admin/pages", permanent: true },
      { source: "/admin/website/navigation", destination: "/admin/header", permanent: true },
      { source: "/admin/website/blog", destination: "/admin/pages", permanent: true },
      { source: "/admin/marketing", destination: "/admin/commerce/coupons", permanent: true },
      { source: "/admin/marketing/coupons", destination: "/admin/commerce/coupons", permanent: true },
      { source: "/admin/marketing/offers", destination: "/admin/commerce/coupons", permanent: true },
      { source: "/admin/marketing/popup", destination: "/admin/banners", permanent: true },
      { source: "/admin/marketing/newsletter", destination: "/admin/inquiries/newsletter", permanent: true },
      { source: "/admin/marketing/emails", destination: "/admin/commerce/emails", permanent: true },
      { source: "/admin/settings/website", destination: "/admin/settings", permanent: true },
      { source: "/admin/settings/seo", destination: "/admin/seo", permanent: true },
    ];
  },
};

export default nextConfig;
