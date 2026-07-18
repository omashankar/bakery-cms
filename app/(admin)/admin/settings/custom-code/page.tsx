import type { Metadata } from "next";
import { CustomCodeSettingsPage } from "@/apps/admin/settings";

export const metadata: Metadata = {
  title: "Custom Code",
  description: "Inject custom CSS and JavaScript into the storefront.",
};

export default function Page() {
  return <CustomCodeSettingsPage />;
}
