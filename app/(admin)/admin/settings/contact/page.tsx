import type { Metadata } from "next";
import { ContactSettingsPage } from "@/features/admin/settings";

export const metadata: Metadata = {
  title: "Contact Settings",
  description: "Business contact information and opening hours.",
};

export default function Page() {
  return <ContactSettingsPage />;
}
