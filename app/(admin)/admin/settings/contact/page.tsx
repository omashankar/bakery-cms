import type { Metadata } from "next";
import { ContactSettingsPage } from "@/apps/admin/settings/components/contact-settings-page";

export const metadata: Metadata = {
  title: "Contact Information",
  description: "Business contact information and opening hours.",
};

export default function Page() {
  return <ContactSettingsPage />;
}
