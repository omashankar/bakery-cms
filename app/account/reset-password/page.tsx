import type { Metadata } from "next";
import { AccountResetPasswordPage } from "@/features/storefront/account/pages/account-reset-password-page";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Create a new password for your bakery account.",
};

export default function Page() {
  return <AccountResetPasswordPage />;
}
