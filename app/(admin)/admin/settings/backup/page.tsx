import type { Metadata } from "next";
import { BackupSettingsPage } from "@/apps/admin/settings";

export const metadata: Metadata = {
  title: "Backup & Restore",
  description: "Export or import local CMS data.",
};

export default function Page() {
  return <BackupSettingsPage />;
}
