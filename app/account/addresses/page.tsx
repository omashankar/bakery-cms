import type { Metadata } from "next";
import { AccountAddressesPage } from "@/features/storefront/account/pages/account-addresses-page";

export const metadata: Metadata = {
  title: "Saved Addresses",
  description: "Manage your delivery addresses.",
};

export default function Page() {
  return <AccountAddressesPage />;
}
