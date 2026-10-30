"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

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
import { AdminSelect } from "@/apps/admin/products/components/admin-field";
import { useAccess } from "@/features/team/lib/access-context";
import { sendInvitation, type InviteResult } from "@/features/team/lib/team-api";
import type { RoleView } from "@/features/team/lib/team-types";

import { PermissionSummary } from "./permission-summary";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Roles the inviter may hand out — the server applies the same rule. */
export function grantableRoles(roles: RoleView[], access: ReturnType<typeof useAccess>["access"]): RoleView[] {
  if (!access) return [];
  if (access.isOwner) return roles;
  const held = new Set<string>(access.permissions);
  return roles.filter((r) => !r.isOwner && r.permissions.every((p) => held.has(p)));
}

interface InviteMemberDialogProps {
  open: boolean;
  roles: RoleView[];
  /** A role to start on — the "Build your team" shortcuts. */
  initialRole?: string;
  onClose: () => void;
  onInvited: () => void;
}

export function InviteMemberDialog(props: InviteMemberDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={(next) => !next && props.onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        {/* Mounted fresh on every open, so it never shows the last invitation. */}
        {props.open ? <InviteDialogBody {...props} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function InviteDialogBody({ roles, initialRole, onClose, onInvited }: InviteMemberDialogProps) {
  const { access } = useAccess();
  const options = grantableRoles(roles, access);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  // Never default to Owner — the most powerful choice must be a deliberate one.
  const [role, setRole] = useState(() =>
    initialRole && options.some((r) => r.slug === initialRole)
      ? initialRole
      : (options.find((r) => !r.isOwner)?.slug ?? ""),
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name: string | null; email: string | null }>({
    name: null,
    email: null,
  });
  const [sending, setSending] = useState(false);
  const [fallback, setFallback] = useState<InviteResult | null>(null);

  const chosen = options.find((r) => r.slug === role);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    // Each problem is said under the box it is about.
    const problems = {
      name: name.trim() ? null : "Enter their name.",
      email: EMAIL.test(email.trim()) ? null : "Enter a valid email address, like name@example.com.",
    };
    setFieldErrors(problems);
    if (problems.name || problems.email) return;
    if (!role) return setError("Choose a role.");
    setSending(true);
    setError(null);
    const result = await sendInvitation({ name: name.trim(), email: email.trim(), role, message: message.trim() });
    setSending(false);
    if (!result.ok || !result.data) {
      // "Already on the team" and "already invited" are about the address.
      if (result.status === 409) setFieldErrors((f) => ({ ...f, email: result.message }));
      else setError(result.message);
      return;
    }
    onInvited();
    if (result.data.emailSent) {
      toast.success(`Invitation sent to ${result.data.invitation.email}`);
      onClose();
    } else {
      // The invitation exists; only the email failed. Hand the link to the
      // owner so they can send it themselves rather than start again.
      setFallback(result.data);
    }
  }

  async function copyLink() {
    if (!fallback?.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(fallback.inviteUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy — select the link and copy it by hand.");
    }
  }

  return (
    <>
      {fallback ? (
        <>
          <DialogHeader>
            <DialogTitle>Invitation created — but the email didn&apos;t send</DialogTitle>
            <DialogDescription>
              {fallback.emailError
                ? `The mail server said: ${fallback.emailError}.`
                : "The shop's email isn't set up yet."}{" "}
              Send this link to {fallback.invitation.name} yourself — on WhatsApp, say. It works once and expires in 7 days.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input value={fallback.inviteUrl ?? ""} readOnly onFocus={(e) => e.currentTarget.select()} aria-label="Invitation link" />
            <Button type="button" variant="outline" onClick={() => void copyLink()}>
              <Copy className="size-4" aria-hidden />
              Copy
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Anyone with this link can join as {fallback.invitation.roleName}. Don&apos;t post it anywhere public.
          </p>
          <DialogFooter>
            <Button onClick={onClose}>Done</Button>
          </DialogFooter>
        </>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>Invite a team member</DialogTitle>
            <DialogDescription>
              They get an email with a link to set their own password. Each person has their own account.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="invite-name-field">Full name</Label>
            <Input
              id="invite-name-field"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setFieldErrors((f) => ({ ...f, name: null }));
              }}
              maxLength={120}
              autoFocus
              aria-invalid={fieldErrors.name ? true : undefined}
            />
            {fieldErrors.name ? <p className="text-xs text-destructive">{fieldErrors.name}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-email-field">Email address</Label>
            <Input
              id="invite-email-field"
              type="email"
              inputMode="email"
              autoComplete="off"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErrors((f) => ({ ...f, email: null }));
              }}
              maxLength={254}
              aria-invalid={fieldErrors.email ? true : undefined}
            />
            {fieldErrors.email ? <p className="text-xs text-destructive">{fieldErrors.email}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-role-field">Role</Label>
            <AdminSelect id="invite-role-field" value={role} onChange={(e) => setRole(e.target.value)}>
              {options.length === 0 ? <option value="">No roles you can give</option> : null}
              {options.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name}
                  {r.isOwner ? " — full access" : ""}
                </option>
              ))}
            </AdminSelect>
            {chosen ? (
              <details className="rounded-md border border-border p-2 text-xs">
                <summary className="cursor-pointer text-muted-foreground">What can a {chosen.name} do?</summary>
                <PermissionSummary permissions={chosen.permissions} className="mt-2 sm:grid-cols-1" />
              </details>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="invite-message-field">Message (optional)</Label>
            <Textarea
              id="invite-message-field"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="Welcome aboard! You'll be handling the morning orders."
            />
          </div>

          {error ? (
            <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={sending || options.length === 0}>
              {sending ? "Sending…" : "Send invitation"}
            </Button>
          </DialogFooter>
        </form>
      )}
    </>
  );
}
