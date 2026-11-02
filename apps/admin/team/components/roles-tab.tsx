"use client";

import { useState } from "react";
import { Copy, Eye, Lock, MoreHorizontal, Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useCan } from "@/features/team/lib/access-context";
import { PERMISSION_MODULES, permissionDefinition } from "@/features/team/lib/permissions";
import { currentLevel } from "@/features/team/lib/access-levels";
import { deleteRole } from "@/features/team/lib/team-api";
import type { RoleView } from "@/features/team/lib/team-types";
import { cn } from "@/lib/utils";

import { RoleEditorDialog, type RoleEditorMode } from "./role-editor-dialog";

/** "Orders · kitchen only" — the area, and how much of it, in the editor's own words. */
function withLevel(label: string, level: string | undefined): string {
  if (level === "kitchen") return `${label} · kitchen only`;
  if (level === "deliveries") return `${label} · own deliveries`;
  if (level === "view") return `${label} · view only`;
  return label;
}

export function RolesTab({
  roles,
  loading,
  error,
  onChanged,
}: {
  roles: RoleView[];
  loading: boolean;
  error: string | null;
  onChanged: () => void;
}) {
  const canManage = useCan("roles.manage");
  const [editor, setEditor] = useState<RoleEditorMode | null>(null);
  const [deleting, setDeleting] = useState<RoleView | null>(null);
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    const result = await deleteRole(deleting.slug);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(`Deleted "${deleting.name}"`);
    setDeleting(null);
    onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Click a role to see what it can do, or to change it.</p>
        {canManage ? (
          <Button onClick={() => setEditor({ kind: "create" })}>
            <Plus className="size-4" aria-hidden />
            Create role
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs" aria-label="Roles">
        {/* Column headings — wide screens only; on a phone each row stacks. */}
        <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_6rem_2.5rem] items-center gap-4 border-b border-border bg-muted/50 px-4 py-2.5 text-xs font-semibold text-muted-foreground lg:grid">
          <span>Role</span>
          <span>Access</span>
          <span>Members</span>
          <span className="sr-only">Actions</span>
        </div>
        <ul className="divide-y divide-border">
          {loading && roles.length === 0
            ? Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="px-4 py-4">
                  <Skeleton className="h-12 w-full" />
                </li>
              ))
            : roles.map((role) => {
                // Each area with HOW MUCH of it: "Orders" alone said the same for the
                // kitchen, a rider and a manager, who see very different things.
                const modules = PERMISSION_MODULES.filter((m) =>
                  role.permissions.some((p) => permissionDefinition(p)?.module === m.id),
                ).map((m) => ({ id: m.id, label: withLevel(m.label, currentLevel(m.id, role.permissions)?.id) }));
                return (
                  <li
                    key={role.slug}
                    className={cn(
                      "relative grid gap-3 px-4 py-4 transition-colors hover:bg-muted/30",
                      "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_6rem_2.5rem] lg:items-center lg:gap-4",
                      role.isOwner && "bg-gold-50/40 dark:bg-gold-900/10",
                    )}
                  >
                    {/* Role */}
                    <div className="flex min-w-0 items-center gap-3 pr-10 lg:pr-0">
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg",
                          role.isOwner
                            ? "bg-gold-100 text-bakery-800 dark:bg-gold-900/40 dark:text-gold-200"
                            : "bg-primary/10 text-primary",
                        )}
                        aria-hidden
                      >
                        {role.isOwner ? <Lock className="size-4" /> : <ShieldCheck className="size-4" />}
                      </span>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            className="font-semibold text-foreground underline-offset-2 hover:underline focus-visible:underline"
                            onClick={() => setEditor({ kind: "view", role })}
                          >
                            {role.name}
                          </button>
                          {role.isOwner ? (
                            <Badge variant="gold" title="Always has full access. Can't be changed.">
                              Protected
                            </Badge>
                          ) : role.isSystem ? (
                            <Badge variant="secondary" title="Comes with the shop. You can edit it, not delete it.">
                              Default
                            </Badge>
                          ) : (
                            <Badge variant="outline" title="Made by you. Edit or delete it freely.">
                              Custom
                            </Badge>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Access */}
                    <div className="flex flex-wrap gap-1.5 pl-12 lg:pl-0">
                      {role.isOwner ? (
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-foreground">Everything</span>
                      ) : modules.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No access yet</span>
                      ) : (
                        <>
                          {modules.slice(0, 4).map((m) => (
                            <span key={m.id} className="rounded-md bg-muted px-2 py-0.5 text-xs text-foreground">
                              {m.label}
                            </span>
                          ))}
                          {modules.length > 4 ? (
                            <span
                              className="rounded-md px-1.5 py-0.5 text-xs text-muted-foreground"
                              title={modules
                                .slice(4)
                                .map((m) => m.label)
                                .join(", ")}
                            >
                              +{modules.length - 4} more
                            </span>
                          ) : null}
                        </>
                      )}
                    </div>

                    {/* Members */}
                    <div className="pl-12 text-sm text-foreground lg:pl-0">
                      <p className="flex items-center gap-1.5">
                        <Users className="size-3.5 text-muted-foreground" aria-hidden />
                        <span className="tabular-nums">{role.memberCount}</span>
                        <span className="text-muted-foreground lg:hidden">
                          {role.memberCount === 1 ? "member" : "members"}
                        </span>
                      </p>
                      {role.pendingInvitations > 0 ? (
                        <p className="mt-0.5 text-xs whitespace-nowrap text-muted-foreground">
                          +{role.pendingInvitations} invited
                        </p>
                      ) : null}
                    </div>

                    {/* Actions — one menu, so the list stays compact. */}
                    <div className="absolute top-3 right-3 lg:static lg:flex lg:justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="ghost" size="icon" aria-label={`Actions for ${role.name}`} />}
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-48">
                          <DropdownMenuItem onClick={() => setEditor({ kind: "view", role })}>
                            <Eye className="size-3.5" />
                            View permissions
                          </DropdownMenuItem>
                          {role.editable ? (
                            <DropdownMenuItem onClick={() => setEditor({ kind: "edit", role })}>
                              <Pencil className="size-3.5" />
                              Edit
                            </DropdownMenuItem>
                          ) : null}
                          {canManage && !role.isOwner ? (
                            <DropdownMenuItem onClick={() => setEditor({ kind: "duplicate", from: role })}>
                              <Copy className="size-3.5" />
                              Duplicate
                            </DropdownMenuItem>
                          ) : null}
                          {canManage && !role.isSystem ? (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={!role.deletable}
                                onClick={() => role.deletable && setDeleting(role)}
                              >
                                <Trash2 className="size-3.5" />
                                {role.deletable ? "Delete" : "Delete — move its members first"}
                              </DropdownMenuItem>
                            </>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                );
              })}
        </ul>
      </section>

      <RoleEditorDialog
        mode={editor}
        templates={roles}
        onClose={() => setEditor(null)}
        onSaved={onChanged}
        onSwitch={setEditor}
      />

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete the &quot;{deleting?.name}&quot; role?</DialogTitle>
            <DialogDescription>
              Nobody has this role, so nobody loses access. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()} disabled={busy}>
              {busy ? "Deleting…" : "Delete role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
