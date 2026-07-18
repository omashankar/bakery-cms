import type { Metadata } from "next";
import { WhatsAppTemplatesAdminPage } from "@/apps/admin/communications/pages/whatsapp-templates-admin-page";

export const metadata: Metadata = {
  title: "WhatsApp Templates",
  description: "Manage WhatsApp Business message templates.",
};

export default function Page() {
  return <WhatsAppTemplatesAdminPage />;
}
