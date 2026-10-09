import type { Metadata } from "next";
import { CustomCodeSettingsPage } from "@/apps/admin/settings/components/custom-code-settings-page";

export const metadata: Metadata = {
  title: "Custom Code",
  description: "Inject custom CSS and JavaScript into the storefront.",
};

export default function Page() {
  return <CustomCodeSettingsPage />;
}
