import type { Metadata } from "next";
import { PermissionsSettingsPage } from "@/apps/admin/settings/components/permissions-settings-page";

export const metadata: Metadata = {
  title: "Roles & Permissions",
  description: "Future role-based access control for the admin panel.",
};

export default function Page() {
  return <PermissionsSettingsPage />;
}
