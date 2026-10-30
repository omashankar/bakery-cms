"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  Eye,
  Link2,
  MailPlus,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  XCircle,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminSelect } from "@/apps/admin/products/components/admin-field";
import { adminShell } from "@/apps/admin/components/admin-shell";
import { useAccess } from "@/features/team/lib/access-context";
import {
  changeMemberRole,
  changeMemberStatus,
  fetchInvitations,
  fetchMembers,
  removeMember,
  invitationLink,
  resendInvitation,
  revokeInvitation,
} from "@/features/team/lib/team-api";
import type { InvitationView, MemberView, RoleView } from "@/features/team/lib/team-types";
import { formatDate } from "@/utils/format";
import { RelativeTime } from "@/components/shared/relative-time";

import { grantableRoles, InviteMemberDialog } from "./invite-member-dialog";
import { PermissionSummary } from "./permission-summary";

const PAGE_SIZE = 20;

type StatusFilter = "" | "active" | "inactive" | "blocked" | "invited";

const STATUS_LABEL: Record<MemberView["status"], string> = {
  active: "Active",
  inactive: "Deactivated",
  blocked: "Blocked",
};

function statusBadge(status: MemberView["status"]) {
  if (status === "active") return <Badge variant="success">Active</Badge>;
  if (status === "blocked") return <Badge variant="destructive">Blocked</Badge>;
  return <Badge variant="warning">Deactivated</Badge>;
}

type Confirm =
  | { kind: "status"; member: MemberView; status: MemberView["status"] }
  | { kind: "remove"; member: MemberView }
  | { kind: "revoke"; invitation: InvitationView };

const CONFIRM_COPY: Record<string, { title: (n: string) => string; body: string; action: string }> = {
  inactive: {
    title: (n) => `Deactivate ${n}?`,
    body: "They are signed out everywhere straight away and can't sign in until you reactivate them. Nothing they did is lost.",
    action: "Deactivate",
  },
  blocked: {
    title: (n) => `Block ${n}?`,
    body: "They are signed out everywhere straight away and can't sign in. Use this when someone should not have access — for example if they've left on bad terms.",
    action: "Block",
  },
  active: {
    title: (n) => `Let ${n} sign in again?`,
    body: "They get back the access their role gives them.",
    action: "Reactivate",
  },
};

export function MembersTab({ roles, onRolesStale }: { roles: RoleView[]; onRolesStale: () => void }) {
  const { access, can } = useAccess();
  const canInvite = can("team.invite");
  const canManage = can("team.manage");

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [page, setPage] = useState(1);

  const [members, setMembers] = useState<MemberView[]>([]);
  const [total, setTotal] = useState(0);
  const [membersState, setMembersState] = useState<"loading" | "ready" | "error">("loading");
  const [membersError, setMembersError] = useState("");
  const [invitations, setInvitations] = useState<InvitationView[]>([]);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<string | undefined>(undefined);
  const [shared, setShared] = useState<{ name: string; email: string; url: string } | null>(null);
  const [viewing, setViewing] = useState<MemberView | null>(null);
  const [changingRole, setChangingRole] = useState<MemberView | null>(null);
  const [nextRole, setNextRole] = useState("");
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);

  // Typing settles before it searches.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  /**
   * Bumped to re-read after a change. The rows already on screen stay until the
   * new ones arrive — a list that blanks on every click is harder to follow.
   */
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (statusFilter === "invited") return;
    let cancelled = false;
    void fetchMembers({
      page,
      limit: PAGE_SIZE,
      q: search,
      role: roleFilter || undefined,
      status: statusFilter || undefined,
    }).then((result) => {
      if (cancelled) return;
      if (result.ok && result.data) {
        setMembers(result.data);
        setTotal(result.pagination?.total ?? result.data.length);
        setMembersState("ready");
      } else {
        setMembersError(result.message);
        setMembersState("error");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [page, search, roleFilter, statusFilter, version]);

  useEffect(() => {
    let cancelled = false;
    void fetchInvitations().then((result) => {
      if (!cancelled && result.ok && result.data) setInvitations(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  function refreshAll() {
    reload();
    onRolesStale();
  }

  const visibleInvitations = useMemo(() => {
    if (statusFilter && statusFilter !== "invited") return [];
    const q = search.trim().toLowerCase();
    return invitations.filter(
      (inv) =>
        (!roleFilter || inv.role === roleFilter) &&
        (!q || inv.name.toLowerCase().includes(q) || inv.email.toLowerCase().includes(q)),
    );
  }, [invitations, statusFilter, roleFilter, search]);

  /** Mirrors the server's rule so the menu does not offer what will be refused. */
  function mayManage(member: MemberView): boolean {
    if (!canManage || !access || member.isSelf) return false;
    if (member.isOwner) return access.isOwner;
    if (access.isOwner) return true;
    const held = new Set<string>(access.permissions);
    return member.permissions.every((p) => held.has(p));
  }

  async function runConfirm() {
    if (!confirm) return;
    setBusy(true);
    const result =
      confirm.kind === "status"
        ? await changeMemberStatus(confirm.member.id, confirm.status as "active" | "inactive" | "blocked")
        : confirm.kind === "remove"
          ? await removeMember(confirm.member.id)
          : await revokeInvitation(confirm.invitation.id);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(result.message);
    setConfirm(null);
    refreshAll();
  }

  async function saveRole() {
    if (!changingRole || !nextRole) return;
    setBusy(true);
    const result = await changeMemberRole(changingRole.id, nextRole);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    toast.success(`${changingRole.name} is now ${roles.find((r) => r.slug === nextRole)?.name ?? nextRole}`);
    setChangingRole(null);
    refreshAll();
  }

  /**
   * Change a role straight from the list, with an Undo. The quick way for the
   * everyday case; the menu's "Change role" shows what the new role allows.
   */
  async function quickRole(member: MemberView, role: string) {
    if (role === member.role) return;
    const result = await changeMemberRole(member.id, role);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    const name = roles.find((r) => r.slug === role)?.name ?? role;
    toast.success(`${member.name} is now ${name}`, {
      action: {
        label: "Undo",
        onClick: () => {
          void changeMemberRole(member.id, member.role).then((back) => {
            if (back.ok) toast.success(`${member.name} is back to ${member.roleName}`);
            else toast.error(back.message);
            refreshAll();
          });
        },
      },
    });
    refreshAll();
  }

/**
   * A link to send by hand — WhatsApp, SMS — for when the email does not
   * arrive. Makes a NEW link, so the one in the email stops working.
   */
  async function copyLink(inv: InvitationView) {
    const result = await invitationLink(inv.id);
    if (!result.ok || !result.data) {
      toast.error(result.message);
      return;
    }
    setShared({ name: inv.name, email: inv.email, url: result.data.inviteUrl });
    reload();
  }

  async function resend(inv: InvitationView) {
    const result = await resendInvitation(inv.id);
    if (!result.ok || !result.data) {
      toast.error(result.message);
      return;
    }
    if (result.data.emailSent) {
      toast.success(`Sent a new link to ${inv.email}`);
    } else if (result.data.inviteUrl) {
      try {
        await navigator.clipboard.writeText(result.data.inviteUrl);
        toast.warning("The email didn't send — a new link is copied, send it yourself.", { duration: 8000 });
      } catch {
        toast.error(`The email didn't send. ${result.data.emailError ?? ""}`);
      }
    }
    reload();
  }

  /** The row's menu — the same for the table and the phone cards. */
  function memberActions(member: MemberView) {
    const manageable = mayManage(member);
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" aria-label={`Actions for ${member.name}`} />}
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuItem onClick={() => setViewing(member)}>
            <Eye className="size-3.5" />
            View permissions
          </DropdownMenuItem>
          {/* Say why the rest is missing, rather than leaving a menu that looks broken. */}
          {!manageable && canManage ? (
            <DropdownMenuItem disabled className="max-w-60 text-xs whitespace-normal">
              {member.isSelf
                ? "You can't change your own role or access. Another owner can."
                : member.isOwner
                  ? "Only an owner can change an owner."
                  : "This member has more access than you, so you can't change them."}
            </DropdownMenuItem>
          ) : null}
          {manageable ? (
            <>
              <DropdownMenuItem
                onClick={() => {
                  setChangingRole(member);
                  setNextRole(member.role);
                }}
              >
                <UserCog className="size-3.5" />
                Change role
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {member.status === "active" ? (
                <>
                  <DropdownMenuItem
                    onClick={() => setConfirm({ kind: "status", member, status: "inactive" })}
                  >
                    <PauseCircle className="size-3.5" />
                    Deactivate
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setConfirm({ kind: "status", member, status: "blocked" })}
                  >
                    <Ban className="size-3.5" />
                    Block
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem
                  onClick={() => setConfirm({ kind: "status", member, status: "active" })}
                >
                  <PlayCircle className="size-3.5" />
                  {member.status === "blocked" ? "Unblock" : "Reactivate"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirm({ kind: "remove", member })}
              >
                <Trash2 className="size-3.5" />
                Remove from team
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const roleChoices = grantableRoles(roles, access);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_12rem_12rem]">
          <label className="relative block">
            <span className="sr-only">Search the team</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or email"
              className="pl-9"
            />
          </label>
          <AdminSelect
            aria-label="Filter by role"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All roles</option>
            {roles.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </AdminSelect>
          <AdminSelect
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="invited">Invited</option>
            <option value="inactive">Deactivated</option>
            <option value="blocked">Blocked</option>
          </AdminSelect>
        </div>
        {canInvite ? (
          <Button
            onClick={() => {
              setInviteRole(undefined);
              setInviteOpen(true);
            }}
          >
            <MailPlus className="size-4" aria-hidden />
            Invite member
          </Button>
        ) : null}
      </div>

      {visibleInvitations.length > 0 ? (
        <section className={adminShell.tableCard} aria-label="Invitations">
          <h3 className="border-b border-border bg-muted/50 px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">
            Invitations
          </h3>
          <ul className="divide-y divide-border">
            {visibleInvitations.map((inv) => (
              <li key={inv.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{inv.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{inv.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{inv.roleName}</Badge>
                  {inv.status === "expired" ? (
                    <Badge variant="destructive">Expired</Badge>
                  ) : (
                    <Badge variant="warning">Invited</Badge>
                  )}
                  <span>
                    {inv.status === "expired" ? "Expired" : "Expires"} {formatDate(inv.expiresAt)}
                    {inv.sentCount > 1 ? ` · sent ${inv.sentCount}×` : ""}
                  </span>
                  {canInvite ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => void resend(inv)}>
                        <RefreshCw className="size-3.5" aria-hidden />
                        Resend
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => void copyLink(inv)}>
                        <Link2 className="size-3.5" aria-hidden />
                        Copy link
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: "revoke", invitation: inv })}>
                        <XCircle className="size-3.5" aria-hidden />
                        Revoke
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {statusFilter !== "invited" ? (
        <section className={adminShell.tableCard} aria-label="Team members">
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 text-left font-semibold">Member</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-semibold">Role</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-semibold">Status</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-semibold">Last sign-in</th>
                  <th scope="col" className="px-4 py-2.5 text-left font-semibold">Joined</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-semibold">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {membersState === "loading" && members.length === 0 ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="px-4 py-3">
                        <Skeleton className="h-8 w-full" />
                      </td>
                    </tr>
                  ))
                ) : membersState === "error" ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-destructive">
                      {membersError || "The team could not be loaded."}{" "}
                      <button
                        type="button"
                        className="underline"
                        onClick={() => {
                          setMembersState("loading");
                          reload();
                        }}
                      >
                        Try again
                      </button>
                    </td>
                  </tr>
                ) : members.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      {search || roleFilter || statusFilter ? "Nobody matches these filters." : "No team members yet."}
                    </td>
                  </tr>
                ) : (
                  members.map((member) => {
                    return (
                      <tr key={member.id}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <MemberAvatar name={member.name} email={member.email} />
                            <div className="min-w-0">
                              <p className="flex items-center gap-1.5 font-medium text-foreground">
                                {member.name}
                                {member.isSelf ? <Badge variant="secondary">You</Badge> : null}
                              </p>
                              <p className="text-xs text-muted-foreground">{member.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {/* Owners are changed through the menu, never by a stray click here. */}
                          {mayManage(member) && !member.isOwner ? (
                            <AdminSelect
                              aria-label={`Role for ${member.name}`}
                              className="h-8 w-44 text-sm"
                              value={member.role}
                              onChange={(e) => void quickRole(member, e.target.value)}
                            >
                              {roleChoices
                                .filter((r) => !r.isOwner)
                                .map((r) => (
                                  <option key={r.slug} value={r.slug}>
                                    {r.name}
                                  </option>
                                ))}
                              {!roleChoices.some((r) => r.slug === member.role) ? (
                                <option value={member.role}>{member.roleName}</option>
                              ) : null}
                            </AdminSelect>
                          ) : (
                            <span className="inline-flex items-center gap-1">
                              {member.isOwner ? <ShieldCheck className="size-3.5 text-primary" aria-hidden /> : null}
                              {member.roleName}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">{statusBadge(member.status)}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {member.lastLoginAt ? <RelativeTime date={member.lastLoginAt} /> : "Never"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {member.joinedAt ? formatDate(member.joinedAt) : "—"}
                          {member.invitedByName ? (
                            <span className="block text-xs">by {member.invitedByName}</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {memberActions(member)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {/* Phones get cards: seven columns do not fit in 390px. */}
          <ul className="divide-y divide-border md:hidden" aria-label="Team members">
            {membersState === "loading" && members.length === 0 ? (
              <li className="p-4">
                <Skeleton className="h-14 w-full" />
              </li>
            ) : membersState === "error" ? (
              <li className="p-4 text-sm text-destructive">{membersError || "The team could not be loaded."}</li>
            ) : members.length === 0 ? (
              <li className="p-6 text-center text-sm text-muted-foreground">
                {search || roleFilter || statusFilter ? "Nobody matches these filters." : "No team members yet."}
              </li>
            ) : (
              members.map((member) => (
                <li key={member.id} className="flex items-start gap-3 px-4 py-3">
                  <MemberAvatar name={member.name} email={member.email} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
                      {member.name}
                      {member.isSelf ? <Badge variant="secondary">You</Badge> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                    <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                      <span className="inline-flex items-center gap-1 font-medium text-foreground">
                        {member.isOwner ? <ShieldCheck className="size-3.5 text-primary" aria-hidden /> : null}
                        {member.roleName}
                      </span>
                      {statusBadge(member.status)}
                      <span className="text-muted-foreground">
                        {member.lastLoginAt ? (
                          <>
                            Signed in <RelativeTime date={member.lastLoginAt} />
                          </>
                        ) : (
                          "Never signed in"
                        )}
                      </span>
                    </div>
                  </div>
                  {memberActions(member)}
                </li>
              ))
            )}
          </ul>
          {total > PAGE_SIZE ? (
            <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">
                Page {page} of {totalPages} · {total} members
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </section>
      ) : visibleInvitations.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No open invitations.
        </p>
      ) : null}

      {/*
        A team of one. The page is otherwise a filter bar and a single row —
        say what it is for, with the three roles a shop most often adds.
      */}
      {canInvite &&
      membersState === "ready" &&
      total <= 1 &&
      invitations.length === 0 &&
      !search &&
      !roleFilter &&
      !statusFilter ? (
        <section className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-5">
          <h3 className="font-semibold text-foreground">Build your team</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Give each person their own sign-in. They only see the part of the admin their role allows —
            the kitchen sees what to make, a rider sees their deliveries, nobody else sees your money.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {grantableRoles(roles, access)
              .filter((r) => ["kitchen-staff", "delivery-staff", "manager"].includes(r.slug))
              .map((r) => (
                <div key={r.slug} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
                  <p className="text-sm font-medium text-foreground">{r.name}</p>
                  <p className="line-clamp-3 flex-1 text-xs text-muted-foreground">{r.description}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setInviteRole(r.slug);
                      setInviteOpen(true);
                    }}
                  >
                    <MailPlus className="size-3.5" aria-hidden />
                    Invite {r.name.toLowerCase()}
                  </Button>
                </div>
              ))}
          </div>
        </section>
      ) : null}

      <InviteMemberDialog
        open={inviteOpen}
        roles={roles}
        initialRole={inviteRole}
        onClose={() => setInviteOpen(false)}
        onInvited={() => {
          reload();
          onRolesStale();
        }}
      />

      <Dialog open={shared !== null} onOpenChange={(open) => !open && setShared(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send {shared?.name} their link</DialogTitle>
            <DialogDescription>
              Send this to {shared?.email} yourself — on WhatsApp or by SMS. It works once and lasts 7 days. Any
              link sent earlier for this invitation no longer works.
            </DialogDescription>
          </DialogHeader>
          <Input
            readOnly
            value={shared?.url ?? ""}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Invitation link"
          />
          <p className="text-xs text-muted-foreground">
            Anyone with this link can join with this role. Don&apos;t post it anywhere public.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              render={
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `You're invited to join our shop's team. Set your password here: ${shared?.url ?? ""}`,
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                />
              }
              nativeButton={false}
            >
              Send on WhatsApp
            </Button>
            <Button
              onClick={() => {
                if (!shared) return;
                void navigator.clipboard
                  .writeText(shared.url)
                  .then(() => toast.success("Link copied"))
                  .catch(() => toast.error("Couldn't copy — select the link and copy it by hand."));
              }}
            >
              Copy link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewing?.name}</DialogTitle>
            <DialogDescription>
              {viewing ? `${viewing.roleName} · ${STATUS_LABEL[viewing.status]}` : null}
            </DialogDescription>
          </DialogHeader>
          {viewing ? <PermissionSummary permissions={viewing.permissions} /> : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={changingRole !== null} onOpenChange={(open) => !open && setChangingRole(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Change {changingRole?.name}&apos;s role</DialogTitle>
            <DialogDescription>
              The new role applies on their next click. They don&apos;t need to sign out.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Current role: <span className="font-medium text-foreground">{changingRole?.roleName}</span>
          </p>
          <div className="space-y-1.5">
            <label htmlFor="new-role" className="text-sm font-medium text-foreground">
              New role
            </label>
            <AdminSelect id="new-role" value={nextRole} onChange={(e) => setNextRole(e.target.value)}>
              {roleChoices.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.name}
                  {r.slug === changingRole?.role ? " (current)" : ""}
                </option>
              ))}
            </AdminSelect>
          </div>
          {roleChoices.find((r) => r.slug === nextRole) ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                What a {roleChoices.find((r) => r.slug === nextRole)!.name} can do
              </p>
              <PermissionSummary permissions={roleChoices.find((r) => r.slug === nextRole)!.permissions} />
            </div>
          ) : null}
          {nextRole === changingRole?.role ? (
            <p className="text-xs text-muted-foreground">Pick a different role to change it.</p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangingRole(null)}>
              Cancel
            </Button>
            <Button onClick={() => void saveRole()} disabled={busy || nextRole === changingRole?.role}>
              {busy ? "Saving…" : "Change role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          {confirm ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {confirm.kind === "status"
                    ? CONFIRM_COPY[confirm.status].title(confirm.member.name)
                    : confirm.kind === "remove"
                      ? `Remove ${confirm.member.name} from the team?`
                      : `Revoke the invitation to ${confirm.invitation.email}?`}
                </DialogTitle>
                <DialogDescription>
                  {confirm.kind === "status"
                    ? CONFIRM_COPY[confirm.status].body
                    : confirm.kind === "remove"
                      ? "Their account is deleted and they're signed out everywhere. Orders and the activity log keep their name and email — nothing they did is lost. To have them back, invite them again."
                      : "The link in their email stops working. You can invite them again later."}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirm(null)}>
                  Cancel
                </Button>
                <Button
                  variant={
                    confirm.kind === "remove" || (confirm.kind === "status" && confirm.status === "blocked")
                      ? "destructive"
                      : "default"
                  }
                  onClick={() => void runConfirm()}
                  disabled={busy}
                >
                  {busy
                    ? "Working…"
                    : confirm.kind === "status"
                      ? CONFIRM_COPY[confirm.status].action
                      : confirm.kind === "remove"
                        ? "Remove"
                        : "Revoke"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Initials in a circle — enough to tell a list of names apart at a glance. */
function MemberAvatar({ name, email }: { name: string; email: string }) {
  const initials =
    (name || email)
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
    >
      {initials}
    </span>
  );
}
