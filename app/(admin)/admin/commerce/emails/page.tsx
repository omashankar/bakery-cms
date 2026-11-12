import type { Metadata } from "next";
import { EmailTemplatesAdminPage } from "@/apps/admin/communications/pages/email-templates-admin-page";
import { whenAllowed } from "@/lib/server/auth/access";
import { readCommunicationsForAdmin } from "@/features/communications/server/communications.initial";

export const metadata: Metadata = {
  title: "Email Templates",
  description: "Manage transactional and marketing email templates.",
};

/** Templates and notification settings, read with the page. */
export default async function Page() {
  const initial = await whenAllowed("settings.view", async (actor) =>
    JSON.parse(JSON.stringify(await readCommunicationsForAdmin(actor))),
  );
  return <EmailTemplatesAdminPage initial={initial} />;
}
