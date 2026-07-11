import type { Metadata } from "next";
import { BackupSettingsPage } from "@/features/admin/settings";

export const metadata: Metadata = {
  title: "Backup & Restore",
  description: "Export or import local CMS data.",
};

export default function Page() {
  return <BackupSettingsPage />;
}
