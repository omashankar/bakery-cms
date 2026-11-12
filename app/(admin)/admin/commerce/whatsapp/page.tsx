import type { Metadata } from "next";
import { WhatsAppTemplatesAdminPage } from "@/apps/admin/communications/pages/whatsapp-templates-admin-page";
import { whenAllowed } from "@/lib/server/auth/access";
import { readCommunicationsForAdmin } from "@/features/communications/server/communications.initial";
import { readWhatsAppConnectionStatus } from "@/features/communications/server/whatsapp-credentials.server";

export const metadata: Metadata = {
  title: "WhatsApp Templates",
  description: "Manage WhatsApp Business message templates.",
};

/** Templates, notification settings and the stored connection, read with the page. */
export default async function Page() {
  const [initial, initialConnection] = await Promise.all([
    whenAllowed("settings.view", async (actor) =>
      JSON.parse(JSON.stringify(await readCommunicationsForAdmin(actor))),
    ),
    // The stored status only — no call to Meta; verifying stays a button.
    whenAllowed("settings.view", async () =>
      JSON.parse(JSON.stringify(await readWhatsAppConnectionStatus())),
    ),
  ]);
  return <WhatsAppTemplatesAdminPage initial={initial} initialConnection={initialConnection} />;
}
