"use client";

import Link from "next/link";
import { Lock, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { routes } from "@/constants/routes";
import { AdminPage, AdminPageHeader } from "@/features/admin/components";

export function PermissionsSettingsPage() {
  return (
    <AdminPage className="space-y-4">
      <AdminPageHeader
        title="Roles & Permissions"
        description="Manage team access when multi-user admin support is enabled."
        actions={
          <Badge variant="secondary" className="gap-1">
            <Lock className="size-3" />
            Future release
          </Badge>
        }
      />

      <Card className="border-amber-200/80 bg-amber-50 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-amber-950 dark:text-amber-100">
            <Shield className="size-4" />
            Coming soon
          </CardTitle>
          <CardDescription className="text-amber-800/90 dark:text-amber-200/90">
            Bakery CMS currently runs in single-admin mode. Role-based access control, invite
            flows, and per-module permissions will ship with the backend release.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            size="sm"
            render={<Link href={routes.admin.settings.security} />}
            nativeButton={false}
          >
            Open Security
          </Button>
        </CardContent>
      </Card>
    </AdminPage>
  );
}
