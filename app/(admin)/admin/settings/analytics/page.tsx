import type { Metadata } from "next";
import { AnalyticsSettingsPage } from "@/apps/admin/settings/components/analytics-settings-page";

export const metadata: Metadata = {
  title: "Analytics",
  description: "Google Analytics, GTM, and tracking pixels.",
};

export default function Page() {
  return <AnalyticsSettingsPage />;
}
