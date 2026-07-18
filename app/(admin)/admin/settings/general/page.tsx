import type { Metadata } from "next";
import { GeneralSettingsPage } from "@/apps/admin/settings";

export const metadata: Metadata = {
  title: "General Settings",
  description: "Site name, logo, timezone, and currency.",
};

export default function Page() {
  return <GeneralSettingsPage />;
}
