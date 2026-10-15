import type { Metadata } from "next";
import { AppearancePage } from "@/apps/admin/appearance/components/appearance-page";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { readSiteLayoutForAdmin } from "@/features/site-layout/server/site-layout.initial";

export const metadata: Metadata = {
  title: "Appearance",
  description: "Theme colors, typography, and live preview.",
};

/**
 * Header, footer and appearance with their versions, read with the page — the
 * three share one gate, so all three or the screen waits for the batch anyway.
 */
export default async function Page() {
  const initial = await whenAdmin(async () =>
    JSON.parse(JSON.stringify(await readSiteLayoutForAdmin())),
  );
  return <AppearancePage initial={initial} />;
}
