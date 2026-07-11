import type { Metadata } from "next";
import { AccountOtpPage } from "@/features/storefront/account/pages/account-otp-page";

export const metadata: Metadata = {
  title: "Verify Email",
  description: "Enter the verification code sent to your email.",
};

export default function Page() {
  return <AccountOtpPage />;
}
