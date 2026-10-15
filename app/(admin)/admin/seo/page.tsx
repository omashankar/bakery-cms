import type { Metadata } from "next";
import { SeoAdminPage } from "@/apps/admin/seo/components/seo-admin-page";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { readSeoForAdmin } from "@/features/site-layout/server/site-layout.initial";

export const metadata: Metadata = {
  title: "SEO",
  description: "Manage meta titles, descriptions, and Open Graph settings.",
};

/** The SEO store and its version, read with the page. */
export default async function Page() {
  const initial = await whenAdmin(async () => JSON.parse(JSON.stringify(await readSeoForAdmin())));
  return <SeoAdminPage initial={initial} />;
}
