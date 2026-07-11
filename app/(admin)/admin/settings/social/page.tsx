import type { Metadata } from "next";
import { SocialSettingsPage } from "@/features/admin/settings";

export const metadata: Metadata = {
  title: "Social Media",
  description: "Social profile links for the site footer.",
};

export default function Page() {
  return <SocialSettingsPage />;
}
