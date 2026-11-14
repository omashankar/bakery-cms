import type { Metadata } from "next";
import { FooterAdminPage } from "@/apps/admin/footer/components/footer-admin-page";
import { whenAllowed } from "@/lib/server/auth/access";
import { readSiteLayoutForAdmin } from "@/features/site-layout/server/site-layout.initial";

export const metadata: Metadata = {
  title: "Footer",
  description: "Configure footer columns and visibility.",
};

/**
 * Header, footer and appearance with their versions, read with the page — the
 * three share one gate, so all three or the screen waits for the batch anyway.
 */
export default async function Page() {
  const initial = await whenAllowed("settings.view", async () =>
    JSON.parse(JSON.stringify(await readSiteLayoutForAdmin())),
  );
  return <FooterAdminPage initial={initial} />;
}
