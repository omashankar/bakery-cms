import type { Metadata } from "next";
import { SmsSettingsPage } from "@/features/admin/settings";

export const metadata: Metadata = {
  title: "SMS Notifications",
  description: "Send order and payment updates over SMS.",
};

export default function Page() {
  return <SmsSettingsPage />;
}
