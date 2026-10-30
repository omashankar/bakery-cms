import { ok, created } from "@/lib/server/http/response";
import { withErrorHandler } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { rateLimit } from "@/lib/server/http/rate-limit";
import { requestContext } from "@/lib/server/audit/audit-log";
import { requireAnyPermission, requirePermission } from "@/lib/server/auth/access";

import * as service from "./team.service";
import {
  acceptInvitationSchema,
  changeRoleSchema,
  changeStatusSchema,
  createRoleSchema,
  inviteSchema,
  memberQuerySchema,
  tokenQuerySchema,
  updateRoleSchema,
} from "./team.validators";

type IdContext = { params: Promise<{ id: string }> };
type SlugContext = { params: Promise<{ slug: string }> };

/**
 * The address the inviter is using, as their browser reports it — so the link
 * in the email opens the same site they invited from. Falls back to the URL the
 * server saw. Only http(s) is trusted.
 */
function origin(request: Request): string {
  const sent = request.headers.get("origin");
  if (sent) {
    try {
      const url = new URL(sent);
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
    } catch {
      // fall through
    }
  }
  return new URL(request.url).origin;
}

// ---- Members ----

export const listMembersController = withErrorHandler(async (request: Request) => {
  const actor = await requirePermission("team.view");
  const query = validate(memberQuerySchema, Object.fromEntries(new URL(request.url).searchParams));
  const { items, total } = await service.listMembers(actor, query);
  return ok(items, "Team members", {
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  });
});

export const changeMemberRoleController = withErrorHandler(async (request: Request, ctx: IdContext) => {
  const actor = await requirePermission("team.manage");
  const { id } = await ctx.params;
  const { role } = validate(changeRoleSchema, await readJson(request));
  await service.changeMemberRole(actor, id, role, requestContext(request));
  return ok({ id, role }, "Role changed");
});

export const changeMemberStatusController = withErrorHandler(async (request: Request, ctx: IdContext) => {
  const actor = await requirePermission("team.manage");
  const { id } = await ctx.params;
  const { status } = validate(changeStatusSchema, await readJson(request));
  await service.changeMemberStatus(actor, id, status, requestContext(request));
  const message =
    status === "active" ? "Member reactivated" : status === "blocked" ? "Member blocked" : "Member deactivated";
  return ok({ id, status }, message);
});

export const removeMemberController = withErrorHandler(async (request: Request, ctx: IdContext) => {
  const actor = await requirePermission("team.manage");
  const { id } = await ctx.params;
  await service.removeMember(actor, id, requestContext(request));
  return ok({ id }, "Member removed");
});

/** Who an order can be handed to for delivery. */
export const deliveryMembersController = withErrorHandler(async () => {
  await requirePermission("orders.assign_delivery");
  return ok(await service.listDeliveryMembers(), "Delivery staff");
});

// ---- Invitations ----

export const listInvitationsController = withErrorHandler(async () => {
  await requirePermission("team.view");
  return ok(await service.listInvitations(), "Invitations");
});

export const inviteController = withErrorHandler(async (request: Request) => {
  const actor = await requirePermission("team.invite");
  // Each invitation is real mail from the shop's account.
  rateLimit(`team-invite:${actor.sub}`, { limit: 30, windowMs: 60 * 60_000 });
  const input = validate(inviteSchema, await readJson(request));
  const result = await service.invite(actor, input, requestContext(request), origin(request));
  return created(result, result.emailSent ? "Invitation sent" : "Invitation created — the email could not be sent");
});

export const resendInvitationController = withErrorHandler(async (request: Request, ctx: IdContext) => {
  const actor = await requirePermission("team.invite");
  rateLimit(`team-invite:${actor.sub}`, { limit: 30, windowMs: 60 * 60_000 });
  const { id } = await ctx.params;
  const result = await service.resendInvitation(actor, id, requestContext(request), origin(request));
  return ok(result, result.emailSent ? "Invitation sent again" : "New link created — the email could not be sent");
});

/** A fresh link to copy and send by hand — no email. Same permission as sending one. */
export const invitationLinkController = withErrorHandler(async (request: Request, ctx: IdContext) => {
  const actor = await requirePermission("team.invite");
  rateLimit(`team-invite:${actor.sub}`, { limit: 30, windowMs: 60 * 60_000 });
  const { id } = await ctx.params;
  const result = await service.shareableInvitationLink(actor, id, requestContext(request), origin(request));
  return ok(result, "New invitation link ready");
});

export const revokeInvitationController = withErrorHandler(async (request: Request, ctx: IdContext) => {
  const actor = await requirePermission("team.invite");
  const { id } = await ctx.params;
  return ok(await service.revokeInvitation(actor, id, requestContext(request)), "Invitation revoked");
});

/**
 * The two PUBLIC endpoints: anyone holding a link may ask about it and accept
 * it. The token is posted in the body — never a query string, which would put
 * it in request logs. Throttled per address; the tokens themselves are 256-bit
 * and not worth guessing.
 */
function throttleInvitationLinks(request: Request) {
  const { ip } = requestContext(request);
  if (ip) rateLimit(`team-invite-link:${ip}`, { limit: 30, windowMs: 15 * 60_000 });
}

export const previewInvitationController = withErrorHandler(async (request: Request) => {
  throttleInvitationLinks(request);
  const { token } = validate(tokenQuerySchema, await readJson(request));
  return ok(await service.previewInvitation(token), "Invitation");
});

export const acceptInvitationController = withErrorHandler(async (request: Request) => {
  throttleInvitationLinks(request);
  const input = validate(acceptInvitationSchema, await readJson(request));
  const result = await service.acceptInvitation(input, requestContext(request));
  return created(result, "Your account is ready. Sign in to continue.");
});

// ---- Roles ----

export const listRolesController = withErrorHandler(async () => {
  // The Team tab needs role names for its filter and the invite form.
  const actor = await requireAnyPermission("roles.view", "team.view");
  return ok(await service.listRoles(actor), "Roles");
});

export const createRoleController = withErrorHandler(async (request: Request) => {
  const actor = await requirePermission("roles.manage");
  const input = validate(createRoleSchema, await readJson(request));
  return created(await service.createRole(actor, input, requestContext(request)), "Role created");
});

export const updateRoleController = withErrorHandler(async (request: Request, ctx: SlugContext) => {
  const actor = await requirePermission("roles.manage");
  const { slug } = await ctx.params;
  const input = validate(updateRoleSchema, await readJson(request));
  return ok(await service.updateRole(actor, slug, input, requestContext(request)), "Role saved");
});

export const deleteRoleController = withErrorHandler(async (request: Request, ctx: SlugContext) => {
  const actor = await requirePermission("roles.manage");
  const { slug } = await ctx.params;
  await service.deleteRole(actor, slug, requestContext(request));
  return ok({ slug }, "Role deleted");
});
