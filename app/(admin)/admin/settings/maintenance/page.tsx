import type { Metadata } from "next";
import { MaintenanceSettingsPage } from "@/features/admin/settings";

export const metadata: Metadata = {
  title: "Maintenance Mode",
  description: "Put the storefront in maintenance mode.",
};

export default function Page() {
  return <MaintenanceSettingsPage />;
}
