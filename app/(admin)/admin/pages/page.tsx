import type { Metadata } from "next";
import { PagesListPage } from "@/apps/admin/pages/components/pages-list-page";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { getPages } from "@/features/content/data/pages.server";

export const metadata: Metadata = {
  title: "Pages",
  description: "Manage static pages like About, Privacy, and Terms.",
};

/** The CMS pages in the HTML; same read as GET /api/pages for staff. */
export default async function Page() {
  const initial = await whenAdmin(async () => JSON.parse(JSON.stringify(await getPages())));
  return <PagesListPage initial={initial} />;
}
