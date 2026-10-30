import type { Metadata } from "next";
import { HeaderAdminPage } from "@/apps/admin/header/components/header-admin-page";
import { whenAllowed } from "@/lib/server/auth/access";
import { readSiteLayoutForAdmin } from "@/features/site-layout/server/site-layout.initial";

export const metadata: Metadata = {
  title: "Header",
  description: "Configure storefront navigation and CTA.",
};

/**
 * Header, footer and appearance with their versions, read with the page — the
 * three share one gate, so all three or the screen waits for the batch anyway.
 */
export default async function Page() {
  const initial = await whenAllowed("settings.view", async () =>
    JSON.parse(JSON.stringify(await readSiteLayoutForAdmin())),
  );
  return <HeaderAdminPage initial={initial} />;
}
