import type { Metadata } from "next";
import { CommerceSettingsPage } from "@/features/admin/settings";

export const metadata: Metadata = {
  title: "Commerce Settings",
  description: "Shipping, tax, payments, and delivery rules for checkout.",
};

export default function Page() {
  return <CommerceSettingsPage />;
}
