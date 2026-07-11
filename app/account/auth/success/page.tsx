import type { Metadata } from "next";
import { AccountAuthSuccessPage } from "@/features/storefront/account/pages/account-auth-success-page";

export const metadata: Metadata = {
  title: "Password Updated",
  description: "Your password has been updated successfully.",
};

export default function Page() {
  return <AccountAuthSuccessPage />;
}
