import type { Metadata } from "next";
import { AdminProfilePage } from "@/features/admin/profile";

export const metadata: Metadata = {
  title: "My Profile",
  description: "Manage your account details and profile photo.",
};

export default function Page() {
  return <AdminProfilePage />;
}
