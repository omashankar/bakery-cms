import type { Metadata } from "next";
import { BannersAdminPage } from "@/apps/admin/banners/components/banners-admin-page";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { readContentForAdmin } from "@/features/content/server/content.initial";
import type { Banner } from "@/types/media";

export const metadata: Metadata = {
  title: "Banners",
  description: "Manage promotional banners and hero slides.",
};

/** Every banner and the version a save must carry, read with the page. */
export default async function Page() {
  const initial = await whenAdmin(async () =>
    JSON.parse(JSON.stringify(await readContentForAdmin<Banner[]>("banners"))),
  );
  return <BannersAdminPage initial={initial} />;
}
