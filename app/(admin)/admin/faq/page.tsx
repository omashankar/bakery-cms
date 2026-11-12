import type { Metadata } from "next";
import { FaqAdminPage } from "@/apps/admin/faq/components/faq-admin-page";
import { whenAllowed } from "@/lib/server/auth/access";
import { readContentForAdmin } from "@/features/content/server/content.initial";
import type { FaqItem } from "@/types/content";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Manage frequently asked questions for the storefront.",
};

/** Every FAQ and the version a save must carry, read with the page. */
export default async function Page() {
  const initial = await whenAllowed("faq.manage", async () =>
    JSON.parse(JSON.stringify(await readContentForAdmin<FaqItem[]>("faq"))),
  );
  return <FaqAdminPage initial={initial} />;
}
