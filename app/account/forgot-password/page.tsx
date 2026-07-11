import type { Metadata } from "next";
import { AccountForgotPasswordPage } from "@/features/storefront/account/pages/account-forgot-password-page";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Reset your bakery account password.",
};

export default function Page() {
  return <AccountForgotPasswordPage />;
}
