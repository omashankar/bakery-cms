import type { Metadata } from "next";
import { SeoAdminPage } from "@/apps/admin/seo/components/seo-admin-page";
import { whenAllowed } from "@/lib/server/auth/access";
import { readSeoForAdmin } from "@/features/site-layout/server/site-layout.initial";

export const metadata: Metadata = {
  title: "SEO",
  description: "Manage meta titles, descriptions, and Open Graph settings.",
};

/** The SEO store and its version, read with the page. */
export default async function Page() {
  const initial = await whenAllowed("settings.view", async () => JSON.parse(JSON.stringify(await readSeoForAdmin())));
  return <SeoAdminPage initial={initial} />;
}
