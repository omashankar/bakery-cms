import type { Metadata } from "next";
import { ModulesSettingsPage } from "@/apps/admin/settings/components/modules-settings-page";

export const metadata: Metadata = {
  title: "Modules",
  description: "Enable or disable optional bakery modules.",
};

export default function Page() {
  return <ModulesSettingsPage />;
}
