import type { Metadata } from "next";
import { MaintenanceSettingsPage } from "@/apps/admin/settings";
import { proxyHeadersAreTrusted } from "@/features/settings/server/maintenance.server";

export const metadata: Metadata = {
  title: "Maintenance Mode",
  description: "Put the storefront in maintenance mode.",
};

export default function Page() {
  // Whether the IP allow-list can work at all is a property of the DEPLOYMENT,
  // not of the settings. Passed in so the field can say so instead of quietly
  // never matching — which is the failure the old "in a future backend
  // integration" version of this page had, in a different form.
  return <MaintenanceSettingsPage ipAllowListWorks={proxyHeadersAreTrusted()} />;
}
