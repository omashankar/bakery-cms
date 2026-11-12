"use client";

import { useRef, useState } from "react";
import { Lock, Pencil } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAccess } from "@/features/team/lib/access-context";
import {
  ALL_PERMISSIONS,
  PERMISSION_MODULES,
  permissionsInModule,
  SYSTEM_ROLES,
  permissionProblems,
  withPrerequisites,
  type Permission,
} from "@/features/team/lib/permissions";
import { AdminSelect } from "@/apps/admin/products/components/admin-field";
import { createRole, updateRole } from "@/features/team/lib/team-api";
import type { RoleView } from "@/features/team/lib/team-types";

import { PermissionMatrix } from "./permission-matrix";
import { PermissionSummary } from "./permission-summary";
import { SimplePermissionPicker } from "./simple-permission-picker";
import { cn } from "@/lib/utils";

export type RoleEditorMode =
  | { kind: "create" }
  | { kind: "duplicate"; from: RoleView }
  | { kind: "edit"; role: RoleView }
  | { kind: "view"; role: RoleView };

function initialState(mode: RoleEditorMode) {
  switch (mode.kind) {
    case "create":
      return { name: "", description: "", permissions: [] as Permission[] };
    case "duplicate":
      return {
        name: `${mode.from.name} (copy)`,
        description: mode.from.description,
        permissions: mode.from.isOwner ? [] : [...mode.from.permissions],
      };
    case "edit":
    case "view":
      return { name: mode.role.name, description: mode.role.description, permissions: [...mode.role.permissions] };
  }
}

export function RoleEditorDialog({
  mode,
  templates = [],
  onClose,
  onSaved,
  onSwitch,
}: {
  mode: RoleEditorMode | null;
  /** Roles a new one can start from. */
  templates?: RoleView[];
  onClose: () => void;
  onSaved: () => void;
  /** Move from viewing a role to editing it. */
  onSwitch?: (mode: RoleEditorMode) => void;
}) {
  if (!mode) return null;
  // VIEWING is reading, not a form: what the role can and cannot do, in words.
  // The 46-checkbox matrix with editable-looking boxes made people think they
  // were about to change something.
  if (mode.kind === "view") {
    const role = mode.role;
    return (
      <RoleSummaryDialog
        role={role}
        onClose={onClose}
        onEdit={role.editable && onSwitch ? () => onSwitch({ kind: "edit", role }) : undefined}
      />
    );
  }
  // Mounted fresh for every role opened, so it starts from that role.
  const key =
    mode.kind === "create"
      ? "create"
      : mode.kind === "duplicate"
        ? `dup-${mode.from.slug}`
        : `${mode.kind}-${mode.role.slug}`;
  return <RoleEditorBody key={key} mode={mode} templates={templates} onClose={onClose} onSaved={onSaved} />;
}

function RoleEditorBody({
  mode,
  templates,
  onClose,
  onSaved,
}: {
  mode: RoleEditorMode;
  templates: RoleView[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { access } = useAccess();
  const [start] = useState(() => initialState(mode));
  const [name, setName] = useState(start.name);
  const [description, setDescription] = useState(start.description);
  const [permissions, setPermissions] = useState<Permission[]>(start.permissions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Simple first: one choice per part of the admin. The full checkbox matrix is
  // there for anyone who needs a single permission on or off.
  const [detailed, setDetailed] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const role = mode.kind === "edit" || mode.kind === "view" ? mode.role : null;
  const readOnly = mode.kind === "view" || Boolean(role?.isOwner);
  // A member who is not an owner can only hand out what they hold themselves;
  // the server enforces the same.
  const held = new Set<string>(access?.permissions ?? []);
  const locked = access?.isOwner ? [] : ALL_PERMISSIONS.filter((p) => !held.has(p));
  const systemDefault = role ? SYSTEM_ROLES.find((r) => r.slug === role.slug) : undefined;

  const title =
    mode.kind === "create"
      ? "Create a role"
      : mode.kind === "duplicate"
        ? `Duplicate "${mode.from.name}"`
        : readOnly
          ? role!.name
          : `Edit "${role!.name}"`;

  /**
   * Leaving with unsaved changes asks first. Escape, a click outside and
   * Cancel all close the dialog, and losing a half-built role to a stray click
   * is the kind of thing that makes people stop trusting a screen.
   */
  const dirty =
    !readOnly &&
    (name !== start.name ||
      description !== start.description ||
      [...permissions].sort().join() !== [...start.permissions].sort().join());
  function requestClose() {
    if (dirty && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }

  async function save() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      // Said beside the box that needs it — the footer is a scroll away from it.
      setNameError("Give the role a name, at least 2 letters.");
      nameRef.current?.focus();
      nameRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    if (permissions.length === 0) {
      setError("Choose at least one thing this role can do — right now it can't open anything.");
      return;
    }
    const problems = permissionProblems(permissions);
    if (problems.length > 0) {
      setError(problems[0].message);
      return;
    }
    setSaving(true);
    setError(null);
    const result =
      mode.kind === "edit"
        ? await updateRole(role!.slug, { name: trimmed, description: description.trim(), permissions })
        : await createRole({ name: trimmed, description: description.trim(), permissions });
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    toast.success(mode.kind === "edit" ? "Role saved" : "Role created");
    onSaved();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && requestClose()}>
      <DialogContent
        className={cn("max-h-[92dvh] overflow-y-auto", detailed ? "sm:max-w-6xl" : "sm:max-w-3xl")}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {role?.isOwner ? <Lock className="size-4 text-muted-foreground" aria-hidden /> : null}
            {title}
          </DialogTitle>
          <DialogDescription>
            {role?.isOwner
              ? "The Owner role always has every permission. It can't be narrowed, so the shop can never be locked out of its own admin."
              : readOnly
                ? "What this role allows."
                : role && role.memberCount > 0
                  ? `Changes apply to ${role.memberCount} member${role.memberCount === 1 ? "" : "s"} on their next click — no need to sign out.`
                  : "Choose what this role can do in each part of the admin. Use Detailed to switch single permissions on or off."}
          </DialogDescription>
        </DialogHeader>

        {!role?.isOwner ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="role-name">Name</Label>
              <Input
                ref={nameRef}
                id="role-name"
                value={name}
                readOnly={readOnly}
                maxLength={60}
                aria-invalid={nameError ? true : undefined}
                aria-describedby={nameError ? "role-name-error" : undefined}
                onChange={(event) => {
                  setName(event.target.value);
                  setNameError(null);
                }}
                placeholder="e.g. Shift Lead"
              />
              {nameError ? (
                <p id="role-name-error" className="text-xs text-destructive">
                  {nameError}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-description">Description</Label>
              <Textarea
                id="role-description"
                value={description}
                readOnly={readOnly}
                maxLength={300}
                rows={2}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What this person does in the shop"
              />
            </div>
          </div>
        ) : null}

        {mode.kind === "create" && templates.some((t) => !t.isOwner) ? (
          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
            <Label htmlFor="role-template" className="text-sm">
              Start from an existing role
              <span className="block text-xs font-normal text-muted-foreground">
                Copies its access — you can change anything after.
              </span>
            </Label>
            <AdminSelect
              id="role-template"
              className="sm:w-60"
              defaultValue=""
              onChange={(event) => {
                const from = templates.find((t) => t.slug === event.target.value);
                setPermissions(
                  from ? withPrerequisites(from.permissions.filter((p) => !locked.includes(p))) : [],
                );
              }}
            >
              <option value="">Start from scratch</option>
              {templates
                .filter((t) => !t.isOwner)
                .map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}
                  </option>
                ))}
            </AdminSelect>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">
            What can this role do?
            {/* The count is for the detailed view, where single permissions are what you see. */}
            {detailed ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">
                {permissions.length} of {ALL_PERMISSIONS.length} permissions
              </span>
            ) : null}
          </p>
          <div role="tablist" aria-label="Editor" className="flex gap-1 rounded-lg bg-muted p-1 text-xs">
            {[
              { id: false, label: "Simple" },
              { id: true, label: "Detailed" },
            ].map((tab) => (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={detailed === tab.id}
                onClick={() => setDetailed(tab.id)}
                className={
                  detailed === tab.id
                    ? "rounded-md bg-card px-3 py-1 font-medium text-foreground shadow-xs"
                    : "rounded-md px-3 py-1 text-muted-foreground hover:text-foreground"
                }
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {detailed ? (
          <PermissionMatrix
            value={role?.isOwner ? ALL_PERMISSIONS : permissions}
            onChange={(next) => {
              setPermissions(next);
              setError(null);
              setConfirmDiscard(false);
            }}
            readOnly={readOnly}
            locked={locked}
          />
        ) : (
          <SimplePermissionPicker
            value={role?.isOwner ? ALL_PERMISSIONS : permissions}
            onChange={(next) => {
              setPermissions(next);
              setError(null);
              setConfirmDiscard(false);
            }}
            readOnly={readOnly}
            locked={locked}
          />
        )}

        {/*
          Pinned: the list is long, and Save must not be a scroll away. A
          problem with saving is said HERE, next to the button that caused it.
        */}
        <DialogFooter className="sticky -bottom-4 z-20 flex-col bg-card sm:flex-col">
          {confirmDiscard ? (
            <div
              role="alert"
              className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="text-sm font-medium text-foreground">Discard your changes to this role?</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setConfirmDiscard(false)}>
                  Keep editing
                </Button>
                <Button type="button" variant="destructive" onClick={onClose}>
                  Discard
                </Button>
              </div>
            </div>
          ) : (
            <>
              {error ? (
                <p role="alert" className="w-full rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {systemDefault && !readOnly ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="sm:mr-auto"
                    onClick={() => {
                      setPermissions([...systemDefault.permissions]);
                      setError(null);
                    }}
                  >
                    Reset to default
                  </Button>
                ) : null}
                <Button type="button" variant="outline" onClick={requestClose}>
                  {readOnly ? "Close" : "Cancel"}
                </Button>
                {!readOnly ? (
                  <Button type="button" onClick={() => void save()} disabled={saving}>
                    {saving ? "Saving…" : mode.kind === "edit" ? "Save changes" : "Create role"}
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoleSummaryDialog({
  role,
  onClose,
  onEdit,
}: {
  role: RoleView;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const held = new Set<string>(role.permissions);
  const notAllowed = role.isOwner
    ? []
    : PERMISSION_MODULES.map((m) => ({
        module: m,
        missing: permissionsInModule(m.id).filter((p) => !held.has(p.id)),
      })).filter((entry) => entry.missing.length > 0);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {role.isOwner ? <Lock className="size-4 text-muted-foreground" aria-hidden /> : null}
            {role.name}
            {role.isOwner ? (
              <Badge variant="gold">Protected</Badge>
            ) : role.isSystem ? (
              <Badge variant="secondary">Default</Badge>
            ) : (
              <Badge variant="outline">Custom</Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {role.description || "No description."}{" "}
            {role.memberCount === 1 ? "1 member has this role." : `${role.memberCount} members have this role.`}
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            {role.isOwner ? "Can do everything" : `Can do (${role.permissions.length} of ${ALL_PERMISSIONS.length})`}
          </h3>
          {role.isOwner ? (
            <p className="text-sm text-muted-foreground">
              Every part of the admin, including the team, roles, payments and security. This can&apos;t be narrowed,
              so the shop can never lock itself out.
            </p>
          ) : (
            <PermissionSummary permissions={role.permissions} />
          )}
        </section>

        {notAllowed.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Can&apos;t do</h3>
            <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
              {notAllowed.map(({ module, missing }) => (
                <li key={module.id} className="text-muted-foreground">
                  <span className="font-medium text-foreground">{module.label}:</span>{" "}
                  {missing.length === permissionsInModule(module.id).length
                    ? "no access"
                    : missing.map((p) => p.label.toLowerCase()).join(", ")}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          {onEdit ? (
            <Button type="button" onClick={onEdit}>
              <Pencil className="size-3.5" aria-hidden />
              Edit this role
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
