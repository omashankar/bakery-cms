import type { Metadata } from "next";
import { OtpFormPage } from "@/features/auth/pages/otp-form-page";

export const metadata: Metadata = {
  title: "OTP Verification",
  description: "One-time password verification screen.",
};

export default function Page() {
  return <OtpFormPage />;
}
