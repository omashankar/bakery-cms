"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { AdminPage, AdminPageHeader } from "@/apps/admin/components/admin-page";
import { MembersTab } from "@/apps/admin/team/components/members-tab";
import { RolesTab } from "@/apps/admin/team/components/roles-tab";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { routes } from "@/constants/routes";
import { useAccess } from "@/features/team/lib/access-context";
import { fetchRoles } from "@/features/team/lib/team-api";
import type { RoleView } from "@/features/team/lib/team-types";

/**
 * Settings → Team & permissions.
 *
 * Two tabs: WHO can sign in (members and invitations) and WHAT each role may do
 * (the roles and their permission matrix). A tab is shown only to someone who
 * may read it; every action inside is checked again by the server.
 */
export function PermissionsSettingsPage({ initialRoles = null }: { initialRoles?: RoleView[] | null } = {}) {
  const { can } = useAccess();
  const showTeam = can("team.view");
  const showRoles = can("roles.view");

  const [roles, setRoles] = useState<RoleView[]>(initialRoles ?? []);
  const [rolesLoading, setRolesLoading] = useState(initialRoles === null);
  const [rolesError, setRolesError] = useState<string | null>(null);

  /**
   * Bumped to re-read after a change. A reload keeps the rows on screen until
   * the new ones arrive; only a first load with nothing from the server shows a
   * skeleton. The server-rendered roles make the first read unnecessary.
   */
  const [version, setVersion] = useState(initialRoles === null ? 1 : 0);
  const loadRoles = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (version === 0) return;
    let cancelled = false;
    void fetchRoles().then((result) => {
      if (cancelled) return;
      setRolesLoading(false);
      if (result.ok && result.data) {
        setRoles(result.data);
        setRolesError(null);
      } else {
        setRolesError(result.message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [version]);

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Team & permissions"
        description="Give each person their own sign-in and a role. A role decides which parts of the admin they can see and what they can change."
        className="gap-3"
        actions={
          <Button variant="outline" render={<Link href={routes.admin.settings.overview} />} nativeButton={false}>
            <ArrowLeft className="size-4" aria-hidden />
            All settings
          </Button>
        }
      />

      <Tabs defaultValue={showTeam ? "team" : "roles"}>
        <TabsList className="mb-4">
          {showTeam ? <TabsTrigger value="team">Team members</TabsTrigger> : null}
          {showRoles ? <TabsTrigger value="roles">Roles &amp; permissions</TabsTrigger> : null}
        </TabsList>
        {showTeam ? (
          <TabsContent value="team">
            <MembersTab roles={roles} onRolesStale={loadRoles} />
          </TabsContent>
        ) : null}
        {showRoles ? (
          <TabsContent value="roles">
            <RolesTab roles={roles} loading={rolesLoading} error={rolesError} onChanged={loadRoles} />
          </TabsContent>
        ) : null}
      </Tabs>
    </AdminPage>
  );
}
