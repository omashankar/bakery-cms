"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { SettingsPlaceholder } from "./settings-placeholder";

export function PermissionsSettingsPage() {
  return (
    <SettingsPlaceholder
      title="Roles & Permissions"
      description="Manage team access when multi-user admin support is enabled."
      icon={ShieldCheck}
      features={[
        "Role-based access control (owner, manager, staff)",
        "Invite team members by email",
        "Per-module permissions (catalog, orders, settings)",
        "Restrict destructive actions to owners",
      ]}
      note={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            Bakery CMS runs in single-admin mode today. Session policies, login history, and
            device access already live in Security.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            render={<Link href={routes.admin.settings.security} />}
            nativeButton={false}
          >
            Open Security
          </Button>
        </div>
      }
    />
  );
}
