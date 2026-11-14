"use client";

import { noteAuthStatus } from "@/features/auth/lib/session-expiry";

import type { Permission } from "./permissions";
import type {
  InvitationPreview,
  InvitationView,
  MemberView,
  RoleView,
  TeamMemberOption,
} from "./team-types";

/**
 * The Team screen's requests. Every answer carries the server's own message,
 * because what went wrong here is usually a RULE ("the shop must keep an active
 * owner", "that email already has an invitation") the person needs to read.
 */

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T | null;
  pagination?: { page: number; limit: number; total: number; totalPages: number } | null;
  errors?: { field: string; message: string }[] | null;
}

export interface TeamResult<T> {
  ok: boolean;
  data: T | null;
  message: string;
  status: number;
  pagination?: Envelope<T>["pagination"];
}

async function call<T>(path: string, init: RequestInit = {}): Promise<TeamResult<T>> {
  try {
    const res = await fetch(path, {
      ...init,
      headers: { Accept: "application/json", ...(init.body ? { "Content-Type": "application/json" } : {}) },
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as Envelope<T> | null;
    if (!res.ok) noteAuthStatus(res.status);
    return {
      ok: res.ok && Boolean(json?.success),
      data: json?.data ?? null,
      message:
        json?.message ||
        (res.ok ? "Done" : res.status === 403 ? "You don't have permission to do this." : "Something went wrong."),
      status: res.status,
      pagination: json?.pagination ?? null,
    };
  } catch {
    return { ok: false, data: null, message: "No connection. Check your internet and try again.", status: 0 };
  }
}

const json = (body: unknown) => JSON.stringify(body);

// ---- Members ----

export function fetchMembers(query: { page: number; limit: number; q?: string; role?: string; status?: string }) {
  const params = new URLSearchParams({ page: String(query.page), limit: String(query.limit) });
  if (query.q?.trim()) params.set("q", query.q.trim());
  if (query.role) params.set("role", query.role);
  if (query.status) params.set("status", query.status);
  return call<MemberView[]>(`/api/team/members?${params}`);
}

export const changeMemberRole = (id: string, role: string) =>
  call<{ id: string; role: string }>(`/api/team/members/${encodeURIComponent(id)}/role`, {
    method: "PATCH",
    body: json({ role }),
  });

export const changeMemberStatus = (id: string, status: "active" | "inactive" | "blocked") =>
  call<{ id: string; status: string }>(`/api/team/members/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: json({ status }),
  });

export const removeMember = (id: string) =>
  call<{ id: string }>(`/api/team/members/${encodeURIComponent(id)}`, { method: "DELETE" });

export const fetchDeliveryStaff = () => call<TeamMemberOption[]>("/api/team/delivery-staff");

// ---- Invitations ----

export interface InviteResult {
  invitation: InvitationView;
  emailSent: boolean;
  emailError?: string;
  inviteUrl?: string;
}

export const fetchInvitations = () => call<InvitationView[]>("/api/team/invitations");

export const sendInvitation = (input: { name: string; email: string; role: string; message?: string }) =>
  call<InviteResult>("/api/team/invitations", { method: "POST", body: json(input) });

export const resendInvitation = (id: string) =>
  call<InviteResult>(`/api/team/invitations/${encodeURIComponent(id)}/resend`, { method: "POST" });

/** A new link to send by hand. The one in the earlier email stops working. */
export const invitationLink = (id: string) =>
  call<{ invitation: InvitationView; inviteUrl: string }>(`/api/team/invitations/${encodeURIComponent(id)}/link`, {
    method: "POST",
  });

export const revokeInvitation = (id: string) =>
  call<InvitationView>(`/api/team/invitations/${encodeURIComponent(id)}`, { method: "DELETE" });

export const lookupInvitation = (token: string) =>
  call<InvitationPreview>("/api/team/invitations/lookup", { method: "POST", body: json({ token }) });

export const acceptInvitation = (input: { token: string; name: string; password: string; confirmPassword: string }) =>
  call<{ email: string }>("/api/team/invitations/accept", { method: "POST", body: json(input) });

// ---- Roles ----

export const fetchRoles = () => call<RoleView[]>("/api/team/roles");

export const createRole = (input: { name: string; description: string; permissions: Permission[] }) =>
  call<RoleView>("/api/team/roles", { method: "POST", body: json(input) });

export const updateRole = (
  slug: string,
  input: { name?: string; description?: string; permissions?: Permission[] },
) => call<RoleView>(`/api/team/roles/${encodeURIComponent(slug)}`, { method: "PUT", body: json(input) });

export const deleteRole = (slug: string) =>
  call<{ slug: string }>(`/api/team/roles/${encodeURIComponent(slug)}`, { method: "DELETE" });
