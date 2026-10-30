"use client";

import { Check } from "lucide-react";

import {
  PERMISSION_MODULES,
  permissionsInModule,
  type Permission,
} from "@/features/team/lib/permissions";
import { cn } from "@/lib/utils";

/**
 * What a set of permissions allows, in words, grouped by part of the admin.
 * Read-only — a member's own profile, and "View permissions" on the Team tab.
 * Modules the set grants nothing in are left out; an empty set says so.
 */
export function PermissionSummary({
  permissions,
  className,
}: {
  permissions: readonly Permission[];
  className?: string;
}) {
  const held = new Set<string>(permissions);
  const modules = PERMISSION_MODULES.map((module) => ({
    module,
    granted: permissionsInModule(module.id).filter((p) => held.has(p.id)),
  })).filter((entry) => entry.granted.length > 0);

  if (modules.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        This role doesn&apos;t include any part of the admin yet.
      </p>
    );
  }

  return (
    <dl className={cn("grid gap-3 sm:grid-cols-2", className)}>
      {modules.map(({ module, granted }) => (
        <div key={module.id} className="rounded-lg border border-border bg-muted/30 p-3">
          <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {module.label}
          </dt>
          <dd className="mt-1.5">
            <ul className="space-y-1">
              {granted.map((p) => (
                <li key={p.id} className="flex items-start gap-1.5 text-sm text-foreground">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                  <span>{p.label}</span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      ))}
    </dl>
  );
}
