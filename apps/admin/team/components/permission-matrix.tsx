"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ALL_PERMISSIONS,
  PERMISSION_MODULES,
  permissionsInModule,
  withoutDependents,
  withPrerequisites,
  type Permission,
  type PermissionColumn,
  type PermissionDefinition,
} from "@/features/team/lib/permissions";
import { cn } from "@/lib/utils";

const COLUMNS: { id: PermissionColumn; label: string }[] = [
  { id: "view", label: "View" },
  { id: "create", label: "Create" },
  { id: "edit", label: "Edit" },
  { id: "status", label: "Manage status" },
  { id: "delete", label: "Delete" },
  { id: "refund", label: "Refund" },
  { id: "special", label: "Special" },
];

/**
 * Modules down the side, kinds of action across the top; each cell holds the
 * permissions of that module and kind.
 *
 * Ticking something that needs another permission ticks that too ("Delete
 * products" needs "View products"); unticking a permission others depend on
 * unticks them. So the matrix can never hand the server a combination it
 * refuses. Sensitive permissions — refunds, deletions, team access — carry a
 * warning mark so they are not ticked as casually as "view".
 */
export function PermissionMatrix({
  value,
  onChange,
  readOnly = false,
  /** Permissions the editor may not grant (they don't hold them). Shown, disabled. */
  locked = [],
}: {
  value: readonly Permission[];
  onChange: (next: Permission[]) => void;
  readOnly?: boolean;
  locked?: readonly Permission[];
}) {
  const held = new Set<string>(value);
  const lockedSet = new Set<string>(locked);

  function toggle(id: Permission, on: boolean) {
    if (readOnly) return;
    onChange(on ? withPrerequisites([...value, id]) : withoutDependents(value, id));
  }

  function setModule(module: PermissionDefinition["module"], on: boolean) {
    const ids = permissionsInModule(module)
      .map((p) => p.id as Permission)
      .filter((id) => !lockedSet.has(id));
    if (on) {
      onChange(withPrerequisites([...value, ...ids]));
    } else {
      let next: Permission[] = [...value];
      for (const id of ids) next = withoutDependents(next, id);
      onChange(next);
    }
  }

  const grantable = ALL_PERMISSIONS.filter((p) => !lockedSet.has(p));

  return (
    <div className="space-y-3">
      {!readOnly ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {value.length} of {ALL_PERMISSIONS.length} permissions selected
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onChange(withPrerequisites([...value, ...grantable]))}
            >
              Select all
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange([])}>
              Clear all
            </Button>
          </div>
        </div>
      ) : null}

      <div className="relative overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[56rem] border-collapse text-sm">
          <thead className="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-48 bg-muted/95 px-3 py-2 text-left font-semibold">
                Module
              </th>
              {COLUMNS.map((column) => (
                <th key={column.id} scope="col" className="px-3 py-2 text-left font-semibold">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {PERMISSION_MODULES.map((module) => {
              const perms = permissionsInModule(module.id);
              const all = perms.every((p) => held.has(p.id));
              const none = perms.every((p) => !held.has(p.id));
              return (
                <tr key={module.id} className={cn("align-top transition-colors", !none && "bg-primary/[0.02]")}>
                  <th scope="row" className="sticky left-0 z-10 w-48 bg-card px-3 py-3 text-left font-normal">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      {module.label}
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                          none ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
                        )}
                      >
                        {perms.filter((p) => held.has(p.id)).length}/{perms.length}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{module.description}</span>
                    {!readOnly ? (
                      <span className="mt-2 flex gap-1.5">
                        <button
                          type="button"
                          className="text-xs font-medium text-primary underline-offset-2 hover:underline disabled:opacity-40"
                          disabled={all}
                          onClick={() => setModule(module.id, true)}
                        >
                          All
                        </button>
                        <span className="text-xs text-muted-foreground">·</span>
                        <button
                          type="button"
                          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline disabled:opacity-40"
                          disabled={none}
                          onClick={() => setModule(module.id, false)}
                        >
                          None
                        </button>
                      </span>
                    ) : null}
                  </th>
                  {COLUMNS.map((column) => {
                    const inCell = perms.filter((p) => p.column === column.id);
                    return (
                      <td key={column.id} className="px-3 py-3">
                        {inCell.length === 0 ? null : (
                          <ul className="space-y-2">
                            {inCell.map((p) => {
                              const id = `perm-${p.id}`;
                              const disabled = readOnly || lockedSet.has(p.id);
                              return (
                                <li key={p.id} className="flex items-start gap-2" title={p.description}>
                                  <Checkbox
                                    id={id}
                                    checked={held.has(p.id)}
                                    disabled={disabled}
                                    onCheckedChange={(checked) => toggle(p.id as Permission, Boolean(checked))}
                                    className="mt-0.5"
                                  />
                                  <label
                                    htmlFor={id}
                                    className={cn(
                                      "text-xs leading-snug text-foreground",
                                      disabled ? "cursor-default" : "cursor-pointer",
                                    )}
                                  >
                                    {p.label}
                                    {p.sensitive ? (
                                      <AlertTriangle
                                        className="ml-1 inline size-3 -translate-y-px text-amber-600"
                                        aria-label="Sensitive"
                                      />
                                    ) : null}
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <AlertTriangle className="size-3 text-amber-600" aria-hidden />
        Sensitive — moves money, deletes things or hands out access. Give it only to people you trust with it.
      </p>

      {/*
        Every checkbox explained in words. Its description is also on hover,
        but a phone has no hover, and "Kitchen queue" or "Own deliveries" is not
        self-explanatory to someone setting up their first role.
      */}
      <details className="group rounded-lg border border-border bg-muted/20">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-foreground">
          What does each permission mean?
        </summary>
        <div className="grid gap-4 border-t border-border p-3 sm:grid-cols-2">
          {PERMISSION_MODULES.map((module) => (
            <div key={module.id}>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{module.label}</p>
              <dl className="mt-1.5 space-y-1.5">
                {permissionsInModule(module.id).map((p) => (
                  <div key={p.id} className="text-xs">
                    <dt className="inline font-medium text-foreground">{p.label}</dt>
                    <dd className="inline text-muted-foreground"> — {p.description}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
