import "server-only";
import { randomBytes } from "node:crypto";

import { sha256 } from "@/lib/server/auth/hash";
import { hashPassword } from "@/lib/server/auth/password";
import { writeAuditLog } from "@/lib/server/audit/audit-log";
import {
  invalidateAccessCache,
  loadRoles,
  permissionsForRole,
  type Actor,
} from "@/lib/server/auth/access";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/server/http/errors";
import { sendTemplatedEmail, publicBaseUrl } from "@/features/communications/server/email.service";
import {
  ALL_PERMISSIONS,
  OWNER_ROLE,
  SYSTEM_ROLES,
  SYSTEM_ROLE_SLUGS,
  isOwnerRole,
  sortPermissions,
  type Permission,
} from "@/features/team/lib/permissions";
import type {
  InvitationPreview,
  InvitationView,
  MemberView,
  RoleView,
  TeamMemberOption,
} from "@/features/team/lib/team-types";

import * as repo from "./team.repository";
import {
  assertCanEditRole,
  assertCanGrantRole,
  assertCanManageMember,
  assertOwnersRemain,
  reducesActiveOwners,
  slugForRoleName,
} from "./team.policy";
import type { InviteInput } from "./team.validators";

/**
 * The team: who may sign in to the admin, and what each role allows.
 *
 * Every function here that changes something is called with the ACTOR, checks
 * the rules in team.policy.ts against them, writes an audit entry with the
 * before and after, and clears the access cache so the change is in force on
 * the member's very next request.
 */

interface RequestCtx {
  ip: string;
  userAgent: string;
}

export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INVITATION_TTL_LABEL = "7 days";

function audit(
  actor: { sub: string; email: string } | null,
  ctx: RequestCtx,
  action: string,
  target: { type: string; id: string },
  metadata: Record<string, unknown>,
) {
  return writeAuditLog({
    action,
    actorId: actor?.sub ?? null,
    actorEmail: actor?.email ?? "",
    target,
    metadata,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
}

function iso(date: Date | null | undefined): string | null {
  return date ? new Date(date).toISOString() : null;
}

function roleName(slug: string, roles: Map<string, { name: string }>): string {
  if (isOwnerRole(slug)) return roles.get(OWNER_ROLE)?.name ?? "Owner";
  return roles.get(slug)?.name ?? "No role";
}

async function grantsOf(slug: string): Promise<Set<Permission>> {
  return permissionsForRole(slug, await loadRoles());
}

// ---- Members -----------------------------------------------------------------

export async function listMembers(
  actor: Actor,
  query: { page: number; limit: number; q?: string; role?: string; status?: string },
): Promise<{ items: MemberView[]; total: number }> {
  const [{ items, total }, roles] = await Promise.all([
    repo.listMembers({ ...query, search: query.q }),
    loadRoles(),
  ]);
  const names = await repo.memberNames(items.map((m) => m.invitedBy).filter(Boolean) as string[]);
  return {
    total,
    items: items.map((m) => ({
      id: m.id,
      name: m.name,
      email: m.email,
      role: isOwnerRole(m.role) ? OWNER_ROLE : m.role,
      roleName: roleName(m.role, roles),
      status: m.status as MemberView["status"],
      isOwner: isOwnerRole(m.role),
      isSelf: m.id === actor.sub,
      lastLoginAt: iso(m.lastLoginAt),
      joinedAt: iso(m.createdAt),
      invitedByName: m.invitedBy ? (names.get(m.invitedBy) ?? null) : null,
      permissions: sortPermissions(permissionsForRole(m.role, roles)),
    })),
  };
}

async function requireMember(id: string) {
  const member = await repo.findMember(id);
  if (!member) throw new NotFoundError("Team member not found");
  return member;
}

async function requireRoleRecord(slug: string) {
  if (isOwnerRole(slug)) {
    return { slug: OWNER_ROLE, name: "Owner", isSystem: true, permissions: [...ALL_PERMISSIONS] };
  }
  const role = await repo.findRole(slug);
  if (!role) {
    throw new ValidationError([{ field: "role", message: "That role does not exist." }], "That role does not exist.");
  }
  return role;
}

export async function changeMemberRole(actor: Actor, id: string, role: string, ctx: RequestCtx) {
  const member = await requireMember(id);
  assertCanManageMember(actor, member, await grantsOf(member.role));
  const next = await requireRoleRecord(role);
  assertCanGrantRole(actor, next);
  if (member.role === next.slug) return member;

  const updated = await repo.inTransaction(async (session) => {
    const fresh = await repo.findMember(id, session);
    if (!fresh) throw new NotFoundError("Team member not found");
    if (reducesActiveOwners(fresh, { role: next.slug })) {
      await repo.touchOwnerGuard(session);
      assertOwnersRemain(await repo.countActiveOwners(session, fresh.id));
    }
    return repo.updateMember(id, { role: next.slug }, session);
  });

  invalidateAccessCache(id);
  await audit(actor, ctx, "team.member.role", { type: "user", id }, {
    email: member.email,
    before: member.role,
    after: next.slug,
  });
  return updated;
}

export async function changeMemberStatus(
  actor: Actor,
  id: string,
  status: "active" | "inactive" | "blocked",
  ctx: RequestCtx,
) {
  const member = await requireMember(id);
  assertCanManageMember(actor, member, await grantsOf(member.role));
  if (member.status === status) return member;

  const updated = await repo.inTransaction(async (session) => {
    const fresh = await repo.findMember(id, session);
    if (!fresh) throw new NotFoundError("Team member not found");
    if (reducesActiveOwners(fresh, { status })) {
      await repo.touchOwnerGuard(session);
      assertOwnersRemain(await repo.countActiveOwners(session, fresh.id));
    }
    return repo.updateMember(id, { status }, session);
  });

  invalidateAccessCache(id);
  // Out of every device now, not when the token next expires.
  if (status !== "active") await repo.endAllSessions(id);
  await audit(actor, ctx, "team.member.status", { type: "user", id }, {
    email: member.email,
    before: member.status,
    after: status,
  });
  return updated;
}

/**
 * Remove a member's account.
 *
 * The ACCOUNT goes; the history does not. Orders, refunds and audit entries
 * record who acted by id and email as text, so nothing they did is rewritten or
 * lost — the activity log goes on showing their email beside what they did.
 */
export async function removeMember(actor: Actor, id: string, ctx: RequestCtx) {
  const member = await requireMember(id);
  assertCanManageMember(actor, member, await grantsOf(member.role));

  await repo.inTransaction(async (session) => {
    const fresh = await repo.findMember(id, session);
    if (!fresh) throw new NotFoundError("Team member not found");
    if (reducesActiveOwners(fresh, { removed: true })) {
      await repo.touchOwnerGuard(session);
      assertOwnersRemain(await repo.countActiveOwners(session, fresh.id));
    }
    await repo.deleteMember(id, session);
  });

  invalidateAccessCache(id);
  await repo.endAllSessions(id);
  await audit(actor, ctx, "team.member.remove", { type: "user", id }, {
    email: member.email,
    name: member.name,
    role: member.role,
    status: member.status,
  });
}

/** The members an order can be assigned to for delivery. */
export async function listDeliveryMembers(): Promise<TeamMemberOption[]> {
  const roles = await loadRoles();
  const eligible = [...roles.keys()].filter((slug) =>
    permissionsForRole(slug, roles).has("orders.view_assigned"),
  );
  // The owner holds every permission, and can be a rider in a one-person shop.
  const members = await repo.activeMembersInRoles([...eligible, ...repo.OWNER_SLUGS]);
  return members.map((m) => ({ id: m.id, name: m.name, roleName: roleName(m.role, roles) }));
}

/** One member, if they are active and their role lets them see their own deliveries. */
export async function deliveryMemberById(id: string): Promise<TeamMemberOption | null> {
  const member = await repo.findMember(id);
  if (!member || member.status !== "active") return null;
  const roles = await loadRoles();
  if (!permissionsForRole(member.role, roles).has("orders.view_assigned")) return null;
  return { id: member.id, name: member.name, roleName: roleName(member.role, roles) };
}

// ---- Invitations ---------------------------------------------------------------

function newToken(): { token: string; tokenHash: string } {
  // 256 bits — not guessable, and only its hash is stored.
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: sha256(token) };
}

/**
 * The link carries the token in the FRAGMENT, after `#`. A browser never sends
 * a fragment to any server — so the token is not in this server's request log,
 * a proxy's, or a Referer header — and the page posts it to the API in a body.
 */
async function inviteUrl(token: string, inviterOrigin: string): Promise<string> {
  // The site the OWNER is on, first. The shop's canonical address (SEO
  // settings) is where customers go — it can point at a deployment that is
  // older, or not live yet, and an invitation that opens a 404 is a dead end
  // for the one person who cannot ask the admin for help: the invitee.
  const base = inviterOrigin.replace(/\/$/, "") || (await publicBaseUrl());
  return `${base}/invite#token=${token}`;
}

function toInvitationView(inv: repo.InvitationRecord, roles: Map<string, { name: string }>): InvitationView {
  const expired = inv.status === "pending" && new Date(inv.expiresAt).getTime() <= Date.now();
  return {
    id: inv.id,
    email: inv.email,
    name: inv.name,
    role: inv.role,
    roleName: roleName(inv.role, roles),
    status: expired ? "expired" : inv.status,
    expiresAt: iso(inv.expiresAt) ?? "",
    invitedByEmail: inv.invitedByEmail,
    sentCount: inv.sentCount,
    lastSentAt: iso(inv.lastSentAt),
    createdAt: iso(inv.createdAt),
  };
}

export async function listInvitations(): Promise<InvitationView[]> {
  const [items, roles] = await Promise.all([repo.listInvitations(), loadRoles()]);
  return items.map((inv) => toInvitationView(inv, roles));
}

export interface InviteResult {
  invitation: InvitationView;
  emailSent: boolean;
  emailError?: string;
  /**
   * Only when the email could NOT be sent, and only to the person who just
   * created the invitation — so they can pass it on themselves. Never logged.
   */
  inviteUrl?: string;
}

async function sendInvitation(
  actor: Actor,
  invitation: { email: string; name: string; role: string; message: string },
  token: string,
  origin: string,
): Promise<{ sent: boolean; error?: string; url: string }> {
  const roles = await loadRoles();
  const url = await inviteUrl(token, origin);
  const mail = await sendTemplatedEmail("team_invite", invitation.email, {
    invitee_name: invitation.name,
    inviter_name: actor.name || actor.email,
    role_name: roleName(invitation.role, roles),
    invite_url: url,
    expires_in: INVITATION_TTL_LABEL,
    personal_message: invitation.message ? `"${invitation.message}"\n\n` : "",
  });
  if (!mail.sent) {
    // The reason, never the link: the link IS the invitation.
    console.error(`[team] Could not email an invitation: ${mail.error}`);
  }
  return { sent: mail.sent, error: mail.error, url };
}

export async function invite(
  actor: Actor,
  input: InviteInput,
  ctx: RequestCtx,
  origin: string,
): Promise<InviteResult> {
  const role = await requireRoleRecord(input.role);
  assertCanGrantRole(actor, role);

  if (await repo.findMemberByEmail(input.email)) {
    throw new ConflictError("Someone with that email is already on the team.");
  }
  const open = await repo.findPendingInvitationByEmail(input.email);
  if (open) {
    if (new Date(open.expiresAt).getTime() > Date.now()) {
      throw new ConflictError("That email already has an open invitation. Resend it instead.");
    }
    await repo.closeLapsedInvitation(open.id);
  }

  const { token, tokenHash } = newToken();
  let invitation: repo.InvitationRecord;
  try {
    invitation = await repo.createInvitation({
      email: input.email,
      name: input.name,
      role: role.slug,
      message: input.message ?? "",
      tokenHash,
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
      invitedBy: actor.sub,
      invitedByEmail: actor.email,
    });
  } catch (error) {
    // Two "Invite" clicks at once: the partial unique index lets one through.
    if ((error as { code?: number }).code === 11000) {
      throw new ConflictError("That email already has an open invitation. Resend it instead.");
    }
    throw error;
  }

  const mail = await sendInvitation(actor, invitation, token, origin);
  await audit(actor, ctx, "team.invite", { type: "invitation", id: invitation.id }, {
    email: invitation.email,
    role: invitation.role,
    emailSent: mail.sent,
  });

  return {
    invitation: toInvitationView(invitation, await loadRoles()),
    emailSent: mail.sent,
    ...(mail.sent ? {} : { emailError: mail.error, inviteUrl: mail.url }),
  };
}

async function requireOpenInvitation(actor: Actor, id: string) {
  const invitation = await repo.findInvitation(id);
  if (!invitation) throw new NotFoundError("Invitation not found");
  if (invitation.status !== "pending") {
    throw new ConflictError(`This invitation has already been ${invitation.status}.`);
  }
  assertCanGrantRole(actor, await requireRoleRecord(invitation.role));
  return invitation;
}

/**
 * A new link for the inviter to pass on THEMSELVES — on WhatsApp, say — with no
 * email at all.
 *
 * For when the email never arrives: the mail server accepted it, so the shop
 * believes it was sent, and nothing else can show the owner a link (only its
 * hash is stored). Issuing a fresh token is the only way to have one to show;
 * the link in the earlier email stops working, which also means a link that
 * went to the wrong place is dead the moment a new one is made.
 */
export async function shareableInvitationLink(
  actor: Actor,
  id: string,
  ctx: RequestCtx,
  origin: string,
): Promise<{ invitation: InvitationView; inviteUrl: string }> {
  const invitation = await requireOpenInvitation(actor, id);
  if (await repo.findMemberByEmail(invitation.email)) {
    throw new ConflictError("Someone with that email is already on the team.");
  }
  const { token, tokenHash } = newToken();
  const reissued = await repo.reissueInvitation(id, tokenHash, new Date(Date.now() + INVITATION_TTL_MS));
  if (!reissued) throw new ConflictError("This invitation is no longer open.");
  await audit(actor, ctx, "team.invite.link", { type: "invitation", id }, { email: reissued.email });
  return {
    invitation: toInvitationView(reissued, await loadRoles()),
    inviteUrl: await inviteUrl(token, origin),
  };
}

/** A NEW link, a fresh week. The link in the earlier email stops working. */
export async function resendInvitation(
  actor: Actor,
  id: string,
  ctx: RequestCtx,
  origin: string,
): Promise<InviteResult> {
  const invitation = await requireOpenInvitation(actor, id);
  if (await repo.findMemberByEmail(invitation.email)) {
    throw new ConflictError("Someone with that email is already on the team.");
  }
  const { token, tokenHash } = newToken();
  const reissued = await repo.reissueInvitation(id, tokenHash, new Date(Date.now() + INVITATION_TTL_MS));
  if (!reissued) throw new ConflictError("This invitation is no longer open.");

  const mail = await sendInvitation(actor, reissued, token, origin);
  await audit(actor, ctx, "team.invite.resend", { type: "invitation", id }, {
    email: reissued.email,
    emailSent: mail.sent,
    sentCount: reissued.sentCount,
  });
  return {
    invitation: toInvitationView(reissued, await loadRoles()),
    emailSent: mail.sent,
    ...(mail.sent ? {} : { emailError: mail.error, inviteUrl: mail.url }),
  };
}

export async function revokeInvitation(actor: Actor, id: string, ctx: RequestCtx) {
  await requireOpenInvitation(actor, id);
  const revoked = await repo.revokeInvitation(id);
  if (!revoked) throw new ConflictError("This invitation is no longer open.");
  await audit(actor, ctx, "team.invite.revoke", { type: "invitation", id }, { email: revoked.email });
  return toInvitationView(revoked, await loadRoles());
}

/**
 * Why a link does not work, in words the invitee can act on — and the SAME
 * words for a link that never existed as for one that was revoked, so the
 * page is not an oracle for which addresses were invited.
 */
const LINK_UNUSABLE = "This invitation link is not valid. Ask the shop owner to send you a new one.";

export async function previewInvitation(token: string): Promise<InvitationPreview> {
  const invitation = await repo.findInvitationByTokenHash(sha256(token));
  if (!invitation || invitation.status === "revoked") throw new NotFoundError(LINK_UNUSABLE);
  if (invitation.status === "accepted") {
    throw new ConflictError("This invitation has already been used. Sign in with your email and password.");
  }
  if (new Date(invitation.expiresAt).getTime() <= Date.now()) {
    throw new AppError("This invitation has expired. Ask the shop owner to send you a new one.", 410);
  }
  const roles = await loadRoles();
  return {
    email: invitation.email,
    name: invitation.name,
    roleName: roleName(invitation.role, roles),
    expiresAt: iso(invitation.expiresAt) ?? "",
  };
}

export async function acceptInvitation(
  input: { token: string; name: string; password: string },
  ctx: RequestCtx,
): Promise<{ email: string }> {
  const tokenHash = sha256(input.token);
  // Hashed before the transaction: bcrypt is slow, and a transaction should
  // not be held open — or retried — around it.
  const passwordHash = await hashPassword(input.password);

  let created: repo.MemberRecord | null = null;
  let invitation: repo.InvitationRecord | null = null;
  try {
    await repo.inTransaction(async (session) => {
      invitation = await repo.claimInvitation(tokenHash, session);
      if (!invitation) {
        // Why not, without saying whether the link ever existed.
        const seen = await repo.findInvitationByTokenHash(tokenHash);
        if (seen?.status === "accepted") {
          throw new ConflictError("This invitation has already been used. Sign in with your email and password.");
        }
        if (seen?.status === "pending") {
          throw new AppError("This invitation has expired. Ask the shop owner to send you a new one.", 410);
        }
        throw new NotFoundError(LINK_UNUSABLE);
      }
      if (await repo.findMemberByEmail(invitation.email, session)) {
        throw new ConflictError("An account with this email already exists. Sign in instead.");
      }
      // The role may have been deleted since — deletion is refused while an open
      // invitation offers it, but a system role cannot vanish at all, and a
      // missing custom one must not become "no role" silently.
      if (!isOwnerRole(invitation.role) && !(await repo.findRole(invitation.role, session))) {
        throw new ConflictError("The role on this invitation no longer exists. Ask for a new invitation.");
      }
      created = await repo.createMember(
        {
          name: input.name.trim() || invitation.name,
          email: invitation.email,
          passwordHash,
          role: invitation.role,
          invitedBy: invitation.invitedBy,
        },
        session,
      );
      await repo.markInvitationAccepted(invitation.id, created.id, session);
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw new ConflictError("An account with this email already exists. Sign in instead.");
    }
    throw error;
  }

  const member = created as repo.MemberRecord | null;
  const accepted = invitation as repo.InvitationRecord | null;
  if (!member || !accepted) throw new AppError("Could not create your account. Please try again.", 500);

  invalidateAccessCache();
  await writeAuditLog({
    action: "team.invite.accept",
    actorId: member.id,
    actorEmail: member.email,
    target: { type: "invitation", id: accepted.id },
    metadata: { role: member.role, invitedBy: accepted.invitedByEmail },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return { email: member.email };
}

// ---- Roles -------------------------------------------------------------------

export async function listRoles(actor: Actor): Promise<RoleView[]> {
  await loadRoles(); // puts back any missing default role
  const [roles, counts, invitations] = await Promise.all([
    repo.listRoles(),
    repo.countMembersByRole(),
    repo.listInvitations(),
  ]);
  const pendingByRole = new Map<string, number>();
  for (const inv of invitations) pendingByRole.set(inv.role, (pendingByRole.get(inv.role) ?? 0) + 1);

  return roles
    .map((role): RoleView => {
      const owner = isOwnerRole(role.slug);
      const permissions = owner ? [...ALL_PERMISSIONS] : sortPermissions(role.permissions);
      const members = owner
        ? repo.OWNER_SLUGS.reduce((sum, slug) => sum + (counts.get(slug) ?? 0), 0)
        : (counts.get(role.slug) ?? 0);
      const pending = pendingByRole.get(role.slug) ?? 0;
      const tooPowerful = !actor.isOwner && permissions.some((p) => !actor.permissions.has(p));
      return {
        slug: role.slug,
        name: role.name,
        // The owner is defined in code and cannot be edited, so it is described
        // by the code too — a description stored by an older build would
        // otherwise stand forever.
        description: owner
          ? (SYSTEM_ROLES.find((r) => r.slug === OWNER_ROLE)?.description ?? role.description)
          : role.description,
        isSystem: role.isSystem || SYSTEM_ROLE_SLUGS.includes(role.slug),
        isOwner: owner,
        permissions,
        memberCount: members,
        pendingInvitations: pending,
        editable: !owner && actor.permissions.has("roles.manage") && !tooPowerful && (actor.isOwner || actor.role !== role.slug),
        deletable:
          !owner &&
          !role.isSystem &&
          !SYSTEM_ROLE_SLUGS.includes(role.slug) &&
          actor.permissions.has("roles.manage") &&
          !tooPowerful &&
          members === 0 &&
          pending === 0,
        updatedAt: iso(role.updatedAt),
      };
    })
    .sort((a, b) => Number(b.isSystem) - Number(a.isSystem));
}

export async function createRole(
  actor: Actor,
  input: { name: string; description?: string; permissions: string[] },
  ctx: RequestCtx,
): Promise<RoleView> {
  const permissions = sortPermissions(input.permissions);
  // An unknown id survives `sortPermissions` only by being dropped — check the
  // raw list, so a typo is refused rather than silently lost.
  assertCanEditRole(actor, { slug: "__new__" }, input.permissions);
  const existing = await repo.listRoles();
  if (existing.some((r) => r.name.trim().toLowerCase() === input.name.trim().toLowerCase())) {
    throw new ConflictError("A role with that name already exists.");
  }
  const slug = slugForRoleName(input.name, new Set(existing.map((r) => r.slug)));
  let role: repo.RoleRecord;
  try {
    role = await repo.createRole({
      slug,
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      permissions,
      createdBy: actor.sub,
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new ConflictError("A role with that name already exists.");
    throw error;
  }
  invalidateAccessCache();
  await audit(actor, ctx, "team.role.create", { type: "role", id: slug }, {
    name: role.name,
    permissions,
  });
  return (await listRoles(actor)).find((r) => r.slug === slug) as RoleView;
}

export async function updateRole(
  actor: Actor,
  slug: string,
  input: { name?: string; description?: string; permissions?: string[] },
  ctx: RequestCtx,
): Promise<RoleView> {
  const role = await repo.findRole(slug);
  if (!role || isOwnerRole(slug)) {
    if (isOwnerRole(slug)) throw new ForbiddenError("The Owner role always has full access. It can't be edited.");
    throw new NotFoundError("Role not found");
  }
  // Editing a role is granting what it holds to everyone who has it — so the
  // same no-escalation rule applies to what it holds NOW and what it will hold.
  assertCanEditRole(actor, role, input.permissions ?? role.permissions);
  if (!actor.isOwner && role.permissions.some((p) => !actor.permissions.has(p as Permission))) {
    throw new ForbiddenError("You can't change a role that has more access than you.");
  }
  if (input.name && input.name.trim().toLowerCase() !== role.name.trim().toLowerCase()) {
    const all = await repo.listRoles();
    if (all.some((r) => r.slug !== slug && r.name.trim().toLowerCase() === input.name!.trim().toLowerCase())) {
      throw new ConflictError("A role with that name already exists.");
    }
  }

  const permissions = input.permissions ? sortPermissions(input.permissions) : undefined;
  const updated = await repo.updateRole(slug, {
    ...(input.name ? { name: input.name.trim() } : {}),
    ...(input.description !== undefined ? { description: input.description.trim() } : {}),
    ...(permissions ? { permissions } : {}),
    updatedBy: actor.sub,
  });
  if (!updated) throw new NotFoundError("Role not found");

  invalidateAccessCache();
  const before = sortPermissions(role.permissions);
  await audit(actor, ctx, "team.role.update", { type: "role", id: slug }, {
    ...(input.name && input.name.trim() !== role.name ? { name: { before: role.name, after: input.name.trim() } } : {}),
    ...(permissions
      ? {
          added: permissions.filter((p) => !before.includes(p)),
          removed: before.filter((p) => !permissions.includes(p)),
        }
      : {}),
  });
  return (await listRoles(actor)).find((r) => r.slug === slug) as RoleView;
}

export async function deleteRole(actor: Actor, slug: string, ctx: RequestCtx): Promise<void> {
  const role = await repo.findRole(slug);
  if (!role) throw new NotFoundError("Role not found");
  if (isOwnerRole(slug) || role.isSystem || SYSTEM_ROLE_SLUGS.includes(slug)) {
    throw new ForbiddenError("Default roles can't be deleted.");
  }
  if (!actor.isOwner && role.permissions.some((p) => !actor.permissions.has(p as Permission))) {
    throw new ForbiddenError("You can't delete a role that has more access than you.");
  }
  const outcome = await repo.inTransaction((session) => repo.deleteRoleIfUnused(slug, session));
  if (outcome === "in_use") {
    throw new ConflictError(
      "This role is still assigned to team members or offered in an open invitation. Move them to another role first.",
    );
  }
  if (outcome === "missing") throw new NotFoundError("Role not found");
  invalidateAccessCache();
  await audit(actor, ctx, "team.role.delete", { type: "role", id: slug }, {
    name: role.name,
    permissions: role.permissions,
  });
}
