import type { Metadata } from "next";
import { SecuritySettingsPage } from "@/apps/admin/settings";

export const metadata: Metadata = {
  title: "Login Security",
  description: "Session timeout, password policy, and login alerts.",
};

export default function Page() {
  return <SecuritySettingsPage />;
}
