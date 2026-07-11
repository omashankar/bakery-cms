import type { Metadata } from "next";
import { ForgotPasswordFormPage } from "@/features/auth/pages/forgot-password-form-page";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Password recovery email form.",
};

export default function Page() {
  return <ForgotPasswordFormPage />;
}
