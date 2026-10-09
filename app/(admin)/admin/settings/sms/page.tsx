import type { Metadata } from "next";
import { SmsSettingsPage } from "@/apps/admin/settings/components/sms-settings-page";

export const metadata: Metadata = {
  title: "SMS Notifications",
  description: "Send order and payment updates over SMS.",
};

export default function Page() {
  return <SmsSettingsPage />;
}
