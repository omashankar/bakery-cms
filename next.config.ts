import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
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
