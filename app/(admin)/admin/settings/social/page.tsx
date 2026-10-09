import type { Metadata } from "next";
import { SocialSettingsPage } from "@/apps/admin/settings/components/social-settings-page";

export const metadata: Metadata = {
  title: "Social Media",
  description: "Social profile links for the site footer.",
};

export default function Page() {
  return <SocialSettingsPage />;
}
