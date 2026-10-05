import type { Metadata } from "next";
import { CommerceSettingsPage } from "@/apps/admin/settings";

export const metadata: Metadata = {
  title: "Order Settings",
  description: "Shipping, tax, payments, and delivery rules for checkout.",
};

export default function Page() {
  return <CommerceSettingsPage />;
}
