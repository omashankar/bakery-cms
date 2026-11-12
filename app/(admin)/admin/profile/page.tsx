import type { Metadata } from "next";
import { AdminProfilePage } from "@/apps/admin/profile/components/admin-profile-page";
import { whenStaff } from "@/lib/server/auth/access";
import { readAdminConfigForAdmin } from "@/features/admin-config/server/admin-config.initial";

export const metadata: Metadata = {
  title: "My Profile",
  description: "Manage your account details and profile photo.",
};

/** The admin's profile and account, read with the page — with the rest of its gate. */
export default async function Page() {
  const initial = await whenStaff(async (actor) =>
    JSON.parse(JSON.stringify(await readAdminConfigForAdmin(actor))),
  );
  return <AdminProfilePage initial={initial} />;
}
