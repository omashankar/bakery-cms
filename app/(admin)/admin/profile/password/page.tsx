import type { Metadata } from "next";
import { ChangePasswordPage } from "@/apps/admin/profile";

export const metadata: Metadata = {
  title: "Change Password",
  description: "Update your account password.",
};

export default function Page() {
  return <ChangePasswordPage />;
}
