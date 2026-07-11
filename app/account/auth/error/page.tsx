import type { Metadata } from "next";
import { AccountAuthErrorPage } from "@/features/storefront/account/pages/account-auth-error-page";

export const metadata: Metadata = {
  title: "Authentication Error",
  description: "Something went wrong with your authentication request.",
};

export default function Page() {
  return <AccountAuthErrorPage />;
}
