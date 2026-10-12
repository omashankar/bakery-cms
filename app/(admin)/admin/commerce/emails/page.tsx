import type { Metadata } from "next";
import { EmailTemplatesAdminPage } from "@/apps/admin/communications/pages/email-templates-admin-page";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { readCommunicationsForAdmin } from "@/features/communications/server/communications.initial";

export const metadata: Metadata = {
  title: "Email Templates",
  description: "Manage transactional and marketing email templates.",
};

/** Templates and notification settings, read with the page. */
export default async function Page() {
  const initial = await whenAdmin(async () =>
    JSON.parse(JSON.stringify(await readCommunicationsForAdmin())),
  );
  return <EmailTemplatesAdminPage initial={initial} />;
}
