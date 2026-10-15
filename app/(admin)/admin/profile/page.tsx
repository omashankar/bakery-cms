import type { Metadata } from "next";
import { AdminProfilePage } from "@/apps/admin/profile/components/admin-profile-page";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { readAdminConfigForAdmin } from "@/features/admin-config/server/admin-config.initial";

export const metadata: Metadata = {
  title: "My Profile",
  description: "Manage your account details and profile photo.",
};

/** The admin's profile and account, read with the page — with the rest of its gate. */
export default async function Page() {
  const initial = await whenAdmin(async () =>
    JSON.parse(JSON.stringify(await readAdminConfigForAdmin())),
  );
  return <AdminProfilePage initial={initial} />;
}
