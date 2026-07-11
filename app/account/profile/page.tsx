import type { Metadata } from "next";
import { AccountProfilePage } from "@/features/storefront/account/pages/account-profile-page";

export const metadata: Metadata = {
  title: "Profile Settings",
  description: "Update your account profile details.",
};

export default function Page() {
  return <AccountProfilePage />;
}
