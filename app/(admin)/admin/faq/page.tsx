import type { Metadata } from "next";
import { FaqAdminPage } from "@/apps/admin/faq/components/faq-admin-page";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { readContentForAdmin } from "@/features/content/server/content.initial";
import type { FaqItem } from "@/types/content";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Manage frequently asked questions for the storefront.",
};

/** Every FAQ and the version a save must carry, read with the page. */
export default async function Page() {
  const initial = await whenAdmin(async () =>
    JSON.parse(JSON.stringify(await readContentForAdmin<FaqItem[]>("faq"))),
  );
  return <FaqAdminPage initial={initial} />;
}
