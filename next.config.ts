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

const nextConfig: NextConfig = {
  // Mongoose is a large CommonJS package with dynamic requires — let Node load it
  // directly instead of bundling it into the server build (faster, avoids issues).
  serverExternalPackages: ["mongoose", "cloudinary"],
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
  async redirects() {
    return [
      { source: "/landing", destination: "/store", permanent: true },
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
