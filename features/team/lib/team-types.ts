import type { Permission } from "./permissions";

/** What the Team screen is told about one member. */
export interface MemberView {
  id: string;
  name: string;
  email: string;
  role: string;
  roleName: string;
  status: "active" | "inactive" | "blocked";
  isOwner: boolean;
  /** The signed-in admin — whose own row offers no actions. */
  isSelf: boolean;
  lastLoginAt: string | null;
  joinedAt: string | null;
  invitedByName: string | null;
  permissions: Permission[];
}

export interface InvitationView {
  id: string;
  email: string;
  name: string;
  role: string;
  roleName: string;
  /** "expired" is derived: still pending, past its date. */
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  invitedByEmail: string;
  sentCount: number;
  lastSentAt: string | null;
  createdAt: string | null;
}

export interface RoleView {
  slug: string;
  name: string;
  description: string;
  isSystem: boolean;
  isOwner: boolean;
  permissions: Permission[];
  memberCount: number;
  pendingInvitations: number;
  /** Whether the signed-in admin may change this role. */
  editable: boolean;
  /** Whether it may be deleted now: a custom role nobody holds. */
  deletable: boolean;
  updatedAt: string | null;
}

/** What the invite page shows before the invitee sets a password. */
export interface InvitationPreview {
  email: string;
  name: string;
  roleName: string;
  expiresAt: string;
}

/** A member offered in a picker — the delivery assignment. */
export interface TeamMemberOption {
  id: string;
  name: string;
  roleName: string;
}
