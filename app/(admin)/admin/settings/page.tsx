import type { Metadata } from "next";
import { SettingsOverviewPage } from "@/features/admin/settings";

export const metadata: Metadata = {
  title: "Settings",
  description: "Site configuration, contact details, security, and system preferences.",
};

export default function Page() {
  return <SettingsOverviewPage />;
}
