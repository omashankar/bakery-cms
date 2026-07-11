import type { Metadata } from "next";
import { AccountLoginPage } from "@/features/storefront/account/pages/account-login-page";

export const metadata: Metadata = {
  title: "Customer Login",
  description: "Sign in to your bakery account.",
};

export default function Page() {
  return <AccountLoginPage />;
}
