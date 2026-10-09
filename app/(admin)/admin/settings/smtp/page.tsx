import type { Metadata } from "next";
import { SmtpSettingsPage } from "@/apps/admin/settings/components/smtp-settings-page";

export const metadata: Metadata = {
  title: "SMTP",
  description: "Outbound email server configuration.",
};

export default function Page() {
  return <SmtpSettingsPage />;
}
