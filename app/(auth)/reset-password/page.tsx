import type { Metadata } from "next";
import { ResetPasswordFormPage } from "@/features/auth/pages/reset-password-form-page";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Set a new password form.",
};

export default function Page() {
  return <ResetPasswordFormPage />;
}
