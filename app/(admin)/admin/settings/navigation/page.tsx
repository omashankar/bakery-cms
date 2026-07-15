import type { Metadata } from "next";
import { NavigationSettingsPage } from "@/features/admin/settings";

export const metadata: Metadata = {
  title: "Navigation Menus",
  description: "Build and reorder storefront navigation menus.",
};

export default function Page() {
  return <NavigationSettingsPage />;
}
