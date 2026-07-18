import type { Metadata } from "next";
import { MaintenanceSettingsPage } from "@/apps/admin/settings";

export const metadata: Metadata = {
  title: "Maintenance Mode",
  description: "Put the storefront in maintenance mode.",
};

export default function Page() {
  return <MaintenanceSettingsPage />;
}
