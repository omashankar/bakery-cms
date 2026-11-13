import mongoose, { type ClientSession } from "mongoose";

import { connectDB } from "@/lib/server/db/mongoose";
import { UserModel } from "@/lib/server/db/models/user.model";
import { RoleModel } from "@/lib/server/db/models/role.model";
import { TeamInvitationModel } from "@/lib/server/db/models/team-invitation.model";
import { TeamGuardModel } from "@/lib/server/db/models/team-guard.model";
import { SessionModel } from "@/lib/server/db/models/session.model";
import { RefreshTokenModel } from "@/lib/server/db/models/refresh-token.model";
import { LEGACY_OWNER_ROLES, OWNER_ROLE } from "@/features/team/lib/permissions";

/**
 * Team persistence. The service decides; this only reads and writes. Functions
 * that take a `session` run inside the caller's transaction.
 */

export const OWNER_SLUGS = [OWNER_ROLE, ...LEGACY_OWNER_ROLES];

export interface MemberRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  lastLoginAt: Date | null;
  createdAt: Date | null;
  invitedBy: string | null;
}

interface RawUser {
  _id: unknown;
  name: string;
  email: string;
  role: string;
  status?: string;
  lastLoginAt?: Date | null;
  createdAt?: Date | null;
  invitedBy?: string | null;
}

function toMember(doc: RawUser): MemberRecord {
  return {
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    role: doc.role,
    status: doc.status ?? "active",
    lastLoginAt: doc.lastLoginAt ?? null,
    createdAt: doc.createdAt ?? null,
    invitedBy: doc.invitedBy ?? null,
  };
}

const MEMBER_FIELDS = "name email role status lastLoginAt createdAt invitedBy";

/** Run `work` in one transaction; the driver retries it on a write conflict. */
export async function inTransaction<T>(work: (session: ClientSession) => Promise<T>): Promise<T> {
  await connectDB();
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result as T;
  } finally {
    await session.endSession();
  }
}

// ---- Members -----------------------------------------------------------------

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listMembers(q: {
  page: number;
  limit: number;
  search?: string;
  role?: string;
  status?: string;
}): Promise<{ items: MemberRecord[]; total: number }> {
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (q.role) filter.role = q.role === OWNER_ROLE ? { $in: OWNER_SLUGS } : q.role;
  if (q.status) filter.status = q.status;
  if (q.search?.trim()) {
    const pattern = new RegExp(escapeRegex(q.search.trim()), "i");
    filter.$or = [{ name: pattern }, { email: pattern }];
  }
  const [docs, total] = await Promise.all([
    UserModel.find(filter)
      .select(MEMBER_FIELDS)
      .sort({ createdAt: 1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    UserModel.countDocuments(filter),
  ]);
  return { items: (docs as unknown as RawUser[]).map(toMember), total };
}

export async function findMember(id: string, session?: ClientSession): Promise<MemberRecord | null> {
  await connectDB();
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await UserModel.findById(id).select(MEMBER_FIELDS).session(session ?? null).lean();
  return doc ? toMember(doc as unknown as RawUser) : null;
}

export async function findMemberByEmail(email: string, session?: ClientSession): Promise<MemberRecord | null> {
  await connectDB();
  const doc = await UserModel.findOne({ email: email.trim().toLowerCase() })
    .select(MEMBER_FIELDS)
    .session(session ?? null)
    .lean();
  return doc ? toMember(doc as unknown as RawUser) : null;
}

/** Names for a handful of ids — the "invited by" column. */
export async function memberNames(ids: string[]): Promise<Map<string, string>> {
  const valid = [...new Set(ids)].filter((id) => mongoose.isValidObjectId(id));
  if (valid.length === 0) return new Map();
  await connectDB();
  const docs = await UserModel.find({ _id: { $in: valid } }).select("name").lean();
  return new Map(docs.map((d) => [String(d._id), d.name]));
}

export async function activeMembersInRoles(roles: string[]): Promise<MemberRecord[]> {
  if (roles.length === 0) return [];
  await connectDB();
  const docs = await UserModel.find({ role: { $in: roles }, status: "active" })
    .select(MEMBER_FIELDS)
    .sort({ name: 1 })
    .lean();
  return (docs as unknown as RawUser[]).map(toMember);
}

export async function countActiveOwners(session: ClientSession, excludeId?: string): Promise<number> {
  return UserModel.countDocuments({
    role: { $in: OWNER_SLUGS },
    status: "active",
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).session(session);
}

/** See team-guard.model.ts — every owner-reducing transaction writes here. */
export async function touchOwnerGuard(session: ClientSession): Promise<void> {
  await TeamGuardModel.updateOne({ _id: "owners" }, { $inc: { version: 1 } }, { upsert: true, session });
}

export async function createMember(
  input: { name: string; email: string; passwordHash: string; role: string; invitedBy: string | null },
  session: ClientSession,
): Promise<MemberRecord> {
  const [doc] = await UserModel.create(
    [{ ...input, email: input.email.trim().toLowerCase(), status: "active" }],
    { session },
  );
  return toMember(doc.toObject() as unknown as RawUser);
}

export async function updateMember(
  id: string,
  fields: { role?: string; status?: string },
  session: ClientSession,
): Promise<MemberRecord | null> {
  const doc = await UserModel.findByIdAndUpdate(id, { $set: fields }, { returnDocument: "after", session })
    .select(MEMBER_FIELDS)
    .lean();
  return doc ? toMember(doc as unknown as RawUser) : null;
}

export async function deleteMember(id: string, session: ClientSession): Promise<boolean> {
  const res = await UserModel.deleteOne({ _id: id }, { session });
  return res.deletedCount === 1;
}

/**
 * Every session and refresh token the member holds, gone — so a blocked or
 * removed member is signed out on their next request, not when their token
 * happens to expire.
 */
export async function endAllSessions(userId: string): Promise<void> {
  await connectDB();
  await RefreshTokenModel.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
  await SessionModel.deleteMany({ userId });
}

export async function countMembersByRole(): Promise<Map<string, number>> {
  await connectDB();
  const rows = await UserModel.aggregate<{ _id: string; count: number }>([
    { $group: { _id: "$role", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [r._id, r.count]));
}

// ---- Roles -------------------------------------------------------------------

export interface RoleRecord {
  slug: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

interface RawRole {
  slug: string;
  name: string;
  description?: string;
  isSystem?: boolean;
  permissions?: string[];
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

function toRole(doc: RawRole): RoleRecord {
  return {
    slug: doc.slug,
    name: doc.name,
    description: doc.description ?? "",
    isSystem: Boolean(doc.isSystem),
    permissions: doc.permissions ?? [],
    createdAt: doc.createdAt ?? null,
    updatedAt: doc.updatedAt ?? null,
  };
}

export async function listRoles(): Promise<RoleRecord[]> {
  await connectDB();
  const docs = await RoleModel.find({}).sort({ isSystem: -1, createdAt: 1 }).lean();
  return (docs as unknown as RawRole[]).map(toRole);
}

export async function findRole(slug: string, session?: ClientSession): Promise<RoleRecord | null> {
  await connectDB();
  const doc = await RoleModel.findOne({ slug }).session(session ?? null).lean();
  return doc ? toRole(doc as unknown as RawRole) : null;
}

export async function createRole(input: {
  slug: string;
  name: string;
  description: string;
  permissions: string[];
  createdBy: string;
}): Promise<RoleRecord> {
  await connectDB();
  const doc = await RoleModel.create({ ...input, isSystem: false, updatedBy: input.createdBy });
  return toRole(doc.toObject() as unknown as RawRole);
}

export async function updateRole(
  slug: string,
  fields: { name?: string; description?: string; permissions?: string[]; updatedBy: string },
): Promise<RoleRecord | null> {
  await connectDB();
  const doc = await RoleModel.findOneAndUpdate({ slug }, { $set: fields }, { returnDocument: "after" }).lean();
  return doc ? toRole(doc as unknown as RawRole) : null;
}

/** Deletes only while nobody holds the role and no open invitation offers it. */
export async function deleteRoleIfUnused(slug: string, session: ClientSession): Promise<"deleted" | "in_use" | "missing"> {
  // One after the other, not Promise.all: a MongoDB transaction runs one
  // operation at a time on its session, and two at once fail the whole delete.
  const members = await UserModel.countDocuments({ role: slug }).session(session);
  const invites = await TeamInvitationModel.countDocuments({ role: slug, status: "pending" }).session(session);
  if (members > 0 || invites > 0) return "in_use";
  const res = await RoleModel.deleteOne({ slug, isSystem: { $ne: true } }, { session });
  return res.deletedCount === 1 ? "deleted" : "missing";
}

// ---- Invitations ---------------------------------------------------------------

export interface InvitationRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  message: string;
  status: "pending" | "accepted" | "revoked";
  expiresAt: Date;
  invitedBy: string | null;
  invitedByEmail: string;
  sentCount: number;
  lastSentAt: Date | null;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date | null;
}

interface RawInvitation {
  _id: unknown;
  email: string;
  name: string;
  role: string;
  message?: string;
  status: "pending" | "accepted" | "revoked";
  expiresAt: Date;
  invitedBy?: string | null;
  invitedByEmail?: string;
  sentCount?: number;
  lastSentAt?: Date | null;
  acceptedAt?: Date | null;
  revokedAt?: Date | null;
  createdAt?: Date | null;
}

function toInvitation(doc: RawInvitation): InvitationRecord {
  return {
    id: String(doc._id),
    email: doc.email,
    name: doc.name,
    role: doc.role,
    message: doc.message ?? "",
    status: doc.status,
    expiresAt: doc.expiresAt,
    invitedBy: doc.invitedBy ?? null,
    invitedByEmail: doc.invitedByEmail ?? "",
    sentCount: doc.sentCount ?? 1,
    lastSentAt: doc.lastSentAt ?? null,
    acceptedAt: doc.acceptedAt ?? null,
    revokedAt: doc.revokedAt ?? null,
    createdAt: doc.createdAt ?? null,
  };
}

const INVITATION_FIELDS = "-tokenHash";

/** Open invitations (pending, including lapsed ones) and the most recent closed ones. */
export async function listInvitations(limit = 100): Promise<InvitationRecord[]> {
  await connectDB();
  const docs = await TeamInvitationModel.find({ status: "pending" })
    .select(INVITATION_FIELDS)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return (docs as unknown as RawInvitation[]).map(toInvitation);
}

export async function findInvitation(id: string): Promise<InvitationRecord | null> {
  await connectDB();
  if (!mongoose.isValidObjectId(id)) return null;
  const doc = await TeamInvitationModel.findById(id).select(INVITATION_FIELDS).lean();
  return doc ? toInvitation(doc as unknown as RawInvitation) : null;
}

export async function findInvitationByTokenHash(tokenHash: string): Promise<InvitationRecord | null> {
  await connectDB();
  const doc = await TeamInvitationModel.findOne({ tokenHash }).select(INVITATION_FIELDS).lean();
  return doc ? toInvitation(doc as unknown as RawInvitation) : null;
}

export async function findPendingInvitationByEmail(email: string): Promise<InvitationRecord | null> {
  await connectDB();
  const doc = await TeamInvitationModel.findOne({ email: email.trim().toLowerCase(), status: "pending" })
    .select(INVITATION_FIELDS)
    .lean();
  return doc ? toInvitation(doc as unknown as RawInvitation) : null;
}

export async function createInvitation(input: {
  email: string;
  name: string;
  role: string;
  message: string;
  tokenHash: string;
  expiresAt: Date;
  invitedBy: string;
  invitedByEmail: string;
}): Promise<InvitationRecord> {
  await connectDB();
  const doc = await TeamInvitationModel.create({
    ...input,
    email: input.email.trim().toLowerCase(),
    status: "pending",
    sentCount: 1,
    lastSentAt: new Date(),
  });
  const plain = doc.toObject() as unknown as RawInvitation;
  return toInvitation(plain);
}

/** A fresh token on a still-pending invitation. The old link stops working. */
export async function reissueInvitation(
  id: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<InvitationRecord | null> {
  await connectDB();
  const doc = await TeamInvitationModel.findOneAndUpdate(
    { _id: id, status: "pending" },
    { $set: { tokenHash, expiresAt, lastSentAt: new Date() }, $inc: { sentCount: 1 } },
    { returnDocument: "after" },
  )
    .select(INVITATION_FIELDS)
    .lean();
  return doc ? toInvitation(doc as unknown as RawInvitation) : null;
}

export async function revokeInvitation(id: string): Promise<InvitationRecord | null> {
  await connectDB();
  const doc = await TeamInvitationModel.findOneAndUpdate(
    { _id: id, status: "pending" },
    { $set: { status: "revoked", revokedAt: new Date() } },
    { returnDocument: "after" },
  )
    .select(INVITATION_FIELDS)
    .lean();
  return doc ? toInvitation(doc as unknown as RawInvitation) : null;
}

/**
 * Claim an invitation for acceptance — the single-use guarantee.
 *
 * One atomic update from `pending` and unexpired to `accepted`: two browsers
 * submitting the same link at once cannot both get past it, and a used,
 * revoked or lapsed link matches nothing.
 */
export async function claimInvitation(
  tokenHash: string,
  session: ClientSession,
): Promise<InvitationRecord | null> {
  const now = new Date();
  const doc = await TeamInvitationModel.findOneAndUpdate(
    { tokenHash, status: "pending", expiresAt: { $gt: now } },
    { $set: { status: "accepted", acceptedAt: now } },
    { returnDocument: "after", session },
  )
    .select(INVITATION_FIELDS)
    .lean();
  return doc ? toInvitation(doc as unknown as RawInvitation) : null;
}

export async function markInvitationAccepted(id: string, userId: string, session: ClientSession): Promise<void> {
  await TeamInvitationModel.updateOne({ _id: id }, { $set: { acceptedUserId: userId } }, { session });
}

/**
 * Close a lapsed pending invitation so the address can be invited again — the
 * partial unique index allows only one pending row per email.
 */
export async function closeLapsedInvitation(id: string): Promise<void> {
  await connectDB();
  await TeamInvitationModel.updateOne(
    { _id: id, status: "pending", expiresAt: { $lte: new Date() } },
    { $set: { status: "revoked", revokedAt: new Date() } },
  );
}
