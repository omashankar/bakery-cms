import type { Metadata } from "next";
import { PermissionsSettingsPage } from "@/apps/admin/settings/components/permissions-settings-page";
import { whenAllowed } from "@/lib/server/auth/access";
import { listRoles } from "@/features/team/server/team.service";

export const metadata: Metadata = {
  title: "Team & permissions",
  description: "Invite team members, assign roles and decide what each role can do.",
};

/** The roles in the HTML: both tabs read them (the Team tab for its filter and invite form). */
export default async function Page() {
  const initialRoles = await whenAllowed(["roles.view", "team.view"], async (actor) =>
    JSON.parse(JSON.stringify(await listRoles(actor))),
  );
  return <PermissionsSettingsPage initialRoles={initialRoles} />;
}
