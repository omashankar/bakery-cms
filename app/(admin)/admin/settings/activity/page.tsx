import type { Metadata } from "next";
import { ActivitySettingsPage } from "@/features/admin/settings";

export const metadata: Metadata = {
  title: "Activity Log",
  description: "Recent admin actions across the CMS.",
};

export default function Page() {
  return <ActivitySettingsPage />;
}
