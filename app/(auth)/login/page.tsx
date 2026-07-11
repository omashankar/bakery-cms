import type { Metadata } from "next";
import { LoginFormPage } from "@/features/auth/pages/login-form-page";

export const metadata: Metadata = {
  title: "Admin Login",
  description: "Secure admin login with remember me.",
};

export default function Page() {
  return <LoginFormPage />;
}
