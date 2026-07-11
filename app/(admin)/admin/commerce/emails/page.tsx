import type { Metadata } from "next";
import { EmailTemplatesAdminPage } from "@/features/admin/communications/pages/email-templates-admin-page";

export const metadata: Metadata = {
  title: "Email Templates",
  description: "Manage transactional and marketing email templates.",
};

export default function Page() {
  return <EmailTemplatesAdminPage />;
}
