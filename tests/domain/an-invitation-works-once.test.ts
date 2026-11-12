/**
 * AN INVITATION WORKS ONCE, EXPIRES, AND CAN BE TAKEN BACK — and the team
 * service enforces its rules on the way.
 *
 * The real team service over an in-memory stand-in for its repository, so the
 * assertions are about behaviour: what is stored (a hash, never the token),
 * what a second use of a link gets, what happens to a blocked member's
 * sessions, and that the last owner cannot be removed.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

import { ALL_PERMISSIONS, SYSTEM_ROLES, type Permission } from "@/features/team/lib/permissions";

type Member = { id: string; name: string; email: string; role: string; status: string; passwordHash?: string; invitedBy: string | null; lastLoginAt: null; createdAt: Date };
type Invite = { id: string; email: string; name: string; role: string; message: string; tokenHash: string; status: "pending" | "accepted" | "revoked"; expiresAt: Date; invitedBy: string; invitedByEmail: string; sentCount: number; lastSentAt: Date | null; acceptedAt: Date | null; revokedAt: Date | null; createdAt: Date };

const db = vi.hoisted(() => ({
  members: [] as Member[],
  invites: [] as Invite[],
  ended: [] as string[],
  audit: [] as Array<{ action: string; metadata?: Record<string, unknown> }>,
  mail: [] as Array<{ to: string; vars: Record<string, string> }>,
  mailWorks: true,
  invalidated: 0,
  seq: 0,
}));

vi.mock("@/lib/server/auth/password", () => ({ hashPassword: async (p: string) => `hashed:${p}` }));
vi.mock("@/lib/server/audit/audit-log", () => ({
  writeAuditLog: async (entry: { action: string; metadata?: Record<string, unknown> }) => {
    db.audit.push(entry);
  },
}));
vi.mock("@/features/communications/server/email.service", () => ({
  publicBaseUrl: async () => "https://shop.example",
  sendTemplatedEmail: async (_slug: string, to: string, vars: Record<string, string>) => {
    db.mail.push({ to, vars });
    return db.mailWorks ? { sent: true } : { sent: false, error: "SMTP not configured" };
  },
}));
vi.mock("@/lib/server/auth/access", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server/auth/access")>();
  const { SYSTEM_ROLES } = await import("@/features/team/lib/permissions");
  return {
    permissionsForRole: real.permissionsForRole,
    loadRoles: async () => new Map(SYSTEM_ROLES.map((r) => [r.slug, { slug: r.slug, name: r.name, permissions: [...r.permissions] }])),
    invalidateAccessCache: () => {
      db.invalidated += 1;
    },
  };
});
vi.mock("@/features/team/server/team.repository", () => {
  const OWNER_SLUGS = ["owner", "admin"];
  const pub = (i: Invite) => ({ ...i });
  return {
    OWNER_SLUGS,
    inTransaction: async <T,>(work: (s: unknown) => Promise<T>) => work({}),
    // Copies, as the real repository returns: the service keeps a "before".
    findMember: async (id: string) => {
      const m = db.members.find((x) => x.id === id);
      return m ? { ...m } : null;
    },
    findMemberByEmail: async (email: string) => {
      const m = db.members.find((x) => x.email === email.toLowerCase());
      return m ? { ...m } : null;
    },
    countActiveOwners: async (_s: unknown, exclude?: string) =>
      db.members.filter((m) => OWNER_SLUGS.includes(m.role) && m.status === "active" && m.id !== exclude).length,
    touchOwnerGuard: async () => undefined,
    createMember: async (input: Omit<Member, "id" | "status" | "lastLoginAt" | "createdAt">) => {
      const m = { ...input, id: `u${++db.seq}`, status: "active", lastLoginAt: null, createdAt: new Date() } as Member;
      db.members.push(m);
      return m;
    },
    updateMember: async (id: string, fields: Partial<Member>) => {
      const m = db.members.find((x) => x.id === id);
      if (m) Object.assign(m, fields);
      return m ?? null;
    },
    deleteMember: async (id: string) => {
      db.members = db.members.filter((m) => m.id !== id);
      return true;
    },
    endAllSessions: async (id: string) => {
      db.ended.push(id);
    },
    findRole: async (slug: string) => {
      const r = SYSTEM_ROLES.find((x) => x.slug === slug);
      return r ? { slug: r.slug, name: r.name, description: "", isSystem: true, permissions: [...r.permissions] } : null;
    },
    listInvitations: async () => db.invites.filter((i) => i.status === "pending").map(pub),
    findInvitation: async (id: string) => db.invites.find((i) => i.id === id) ?? null,
    findInvitationByTokenHash: async (h: string) => db.invites.find((i) => i.tokenHash === h) ?? null,
    findPendingInvitationByEmail: async (email: string) =>
      db.invites.find((i) => i.email === email.toLowerCase() && i.status === "pending") ?? null,
    createInvitation: async (input: Omit<Invite, "id" | "status" | "sentCount" | "lastSentAt" | "acceptedAt" | "revokedAt" | "createdAt">) => {
      const inv: Invite = { ...input, email: input.email.toLowerCase(), id: `i${++db.seq}`, status: "pending", sentCount: 1, lastSentAt: new Date(), acceptedAt: null, revokedAt: null, createdAt: new Date() };
      db.invites.push(inv);
      return pub(inv);
    },
    reissueInvitation: async (id: string, tokenHash: string, expiresAt: Date) => {
      const inv = db.invites.find((i) => i.id === id && i.status === "pending");
      if (!inv) return null;
      Object.assign(inv, { tokenHash, expiresAt, sentCount: inv.sentCount + 1 });
      return pub(inv);
    },
    revokeInvitation: async (id: string) => {
      const inv = db.invites.find((i) => i.id === id && i.status === "pending");
      if (!inv) return null;
      Object.assign(inv, { status: "revoked", revokedAt: new Date() });
      return pub(inv);
    },
    claimInvitation: async (tokenHash: string) => {
      const inv = db.invites.find((i) => i.tokenHash === tokenHash && i.status === "pending" && i.expiresAt.getTime() > Date.now());
      if (!inv) return null;
      Object.assign(inv, { status: "accepted", acceptedAt: new Date() });
      return pub(inv);
    },
    markInvitationAccepted: async () => undefined,
    closeLapsedInvitation: async (id: string) => {
      const inv = db.invites.find((i) => i.id === id);
      if (inv && inv.expiresAt.getTime() <= Date.now()) inv.status = "revoked";
    },
  };
});

import * as team from "@/features/team/server/team.service";

const ctx = { ip: "1.2.3.4", userAgent: "test" };
const sha = (v: string) => createHash("sha256").update(v).digest("hex");

function actor(role: string, sub: string, permissions?: Permission[]) {
  const sys = SYSTEM_ROLES.find((r) => r.slug === role);
  return {
    sub,
    email: `${sub}@example.com`,
    name: sub,
    role,
    roleName: role,
    isOwner: role === "owner",
    permissions: new Set<Permission>(permissions ?? (role === "owner" ? ALL_PERMISSIONS : sys?.permissions ?? [])),
  };
}
const owner = actor("owner", "owner-1");

function tokenFrom(url: string): string {
  return new URL(url).hash.replace("#token=", "");
}

beforeEach(() => {
  db.members = [
    { id: "owner-1", name: "Owner", email: "owner@example.com", role: "owner", status: "active", invitedBy: null, lastLoginAt: null, createdAt: new Date() },
  ];
  db.invites = [];
  db.ended = [];
  db.audit = [];
  db.mail = [];
  db.mailWorks = true;
  db.invalidated = 0;
});

describe("sending an invitation", () => {
  it("stores only a hash of the token, and mails a link with the token in the fragment", async () => {
    const result = await team.invite(owner, { name: "Ravi", email: "Ravi@Example.com", role: "delivery-staff", message: "" }, ctx, "https://admin.shop.example");
    expect(result.emailSent).toBe(true);
    expect(result.inviteUrl).toBeUndefined();

    const url = db.mail[0].vars.invite_url;
    // The site the owner invited FROM, not the canonical one in SEO settings.
    expect(url.startsWith("https://admin.shop.example/invite#token=")).toBe(true);
    const token = tokenFrom(url);
    expect(token.length).toBeGreaterThanOrEqual(40);
    expect(db.invites[0].tokenHash).toBe(sha(token));
    expect(JSON.stringify(db.invites)).not.toContain(token);
    expect(JSON.stringify(db.audit)).not.toContain(token);
    expect(db.audit.map((a) => a.action)).toContain("team.invite");
  });

  it("refuses someone already on the team, and a second open invitation", async () => {
    await expect(team.invite(owner, { name: "O", email: "owner@example.com", role: "manager", message: "" }, ctx, "")).rejects.toMatchObject({ status: 409 });
    await team.invite(owner, { name: "A", email: "a@example.com", role: "manager", message: "" }, ctx, "");
    await expect(team.invite(owner, { name: "A", email: "a@example.com", role: "manager", message: "" }, ctx, "")).rejects.toMatchObject({ status: 409 });
  });

  it("when the email fails, the inviter alone is handed the link to pass on", async () => {
    db.mailWorks = false;
    const result = await team.invite(owner, { name: "K", email: "k@example.com", role: "kitchen-staff", message: "" }, ctx, "");
    expect(result.emailSent).toBe(false);
    expect(result.inviteUrl).toContain("#token=");
    expect(JSON.stringify(db.audit)).not.toContain(tokenFrom(result.inviteUrl!));
  });

  it("a non-owner cannot invite an owner, or give more than they hold", async () => {
    const lead = actor("custom", "lead-1", ["team.view", "team.invite", "orders.view"]);
    await expect(team.invite(lead, { name: "X", email: "x@example.com", role: "owner", message: "" }, ctx, "")).rejects.toMatchObject({ status: 403 });
    await expect(team.invite(lead, { name: "X", email: "x@example.com", role: "manager", message: "" }, ctx, "")).rejects.toMatchObject({ status: 403 });
  });
});

describe("accepting it", () => {
  async function invited(role = "kitchen-staff") {
    await team.invite(owner, { name: "Kiran", email: "kiran@example.com", role, message: "" }, ctx, "");
    return tokenFrom(db.mail.at(-1)!.vars.invite_url);
  }

  it("creates an active account with the invited role, once", async () => {
    const token = await invited();
    await team.acceptInvitation({ token, name: "Kiran K", password: "bake1234" }, ctx);
    const member = db.members.find((m) => m.email === "kiran@example.com")!;
    expect(member).toMatchObject({ role: "kitchen-staff", status: "active", name: "Kiran K", passwordHash: "hashed:bake1234", invitedBy: "owner-1" });

    await expect(team.acceptInvitation({ token, name: "Again", password: "bake1234" }, ctx)).rejects.toMatchObject({ status: 409 });
    expect(db.members.filter((m) => m.email === "kiran@example.com")).toHaveLength(1);
  });

  it("refuses an expired link with 410, and a made-up one with 404", async () => {
    const token = await invited();
    db.invites[0].expiresAt = new Date(Date.now() - 1000);
    await expect(team.previewInvitation(token)).rejects.toMatchObject({ status: 410 });
    await expect(team.acceptInvitation({ token, name: "K", password: "bake1234" }, ctx)).rejects.toMatchObject({ status: 410 });
    await expect(team.previewInvitation("x".repeat(43))).rejects.toMatchObject({ status: 404 });
  });

  it("a revoked link answers exactly like one that never existed", async () => {
    const token = await invited();
    await team.revokeInvitation(owner, db.invites[0].id, ctx);
    const refusal = (t: string) =>
      team.previewInvitation(t).then(
        () => null,
        (e: Error & { status: number }) => e,
      );
    const revoked = (await refusal(token))!;
    const unknown = (await refusal("y".repeat(43)))!;
    expect([revoked.status, revoked.message]).toEqual([unknown.status, unknown.message]);
  });

  it("'Copy link' gives the owner a working link without sending any email, and kills the emailed one", async () => {
    const emailed = await invited();
    const mailsBefore = db.mail.length;
    const shared = await team.shareableInvitationLink(owner, db.invites[0].id, ctx, "http://localhost:3000");
    expect(db.mail.length).toBe(mailsBefore);
    expect(shared.inviteUrl.startsWith("http://localhost:3000/invite#token=")).toBe(true);
    const token = tokenFrom(shared.inviteUrl);
    await expect(team.previewInvitation(token)).resolves.toMatchObject({ email: "kiran@example.com" });
    await expect(team.previewInvitation(emailed)).rejects.toMatchObject({ status: 404 });
    expect(JSON.stringify(db.audit)).not.toContain(token);
    expect(db.audit.map((a) => a.action)).toContain("team.invite.link");
  });

  it("resending issues a new link and kills the old one", async () => {
    const first = await invited();
    await team.resendInvitation(owner, db.invites[0].id, ctx, "");
    const second = tokenFrom(db.mail.at(-1)!.vars.invite_url);
    expect(second).not.toBe(first);
    await expect(team.previewInvitation(first)).rejects.toMatchObject({ status: 404 });
    await expect(team.previewInvitation(second)).resolves.toMatchObject({ email: "kiran@example.com" });
  });
});

describe("changing a member", () => {
  beforeEach(() => {
    db.members.push({ id: "m1", name: "Meera", email: "meera@example.com", role: "manager", status: "active", invitedBy: "owner-1", lastLoginAt: null, createdAt: new Date() });
  });

  it("blocking signs them out everywhere and takes effect on their next request", async () => {
    await team.changeMemberStatus(owner, "m1", "blocked", ctx);
    expect(db.members.find((m) => m.id === "m1")!.status).toBe("blocked");
    expect(db.ended).toContain("m1");
    expect(db.invalidated).toBeGreaterThan(0);
    expect(db.audit.find((a) => a.action === "team.member.status")?.metadata).toMatchObject({ before: "active", after: "blocked" });
  });

  it("a role change is audited with before and after, and clears the access cache", async () => {
    await team.changeMemberRole(owner, "m1", "kitchen-staff", ctx);
    expect(db.audit.find((a) => a.action === "team.member.role")?.metadata).toMatchObject({ before: "manager", after: "kitchen-staff" });
    expect(db.invalidated).toBeGreaterThan(0);
  });

  it("the last active owner cannot be demoted, blocked or removed — by another owner either", async () => {
    db.members.push({ id: "owner-2", name: "Co", email: "co@example.com", role: "owner", status: "blocked", invitedBy: null, lastLoginAt: null, createdAt: new Date() });
    const otherOwner = actor("owner", "owner-2");
    await expect(team.changeMemberRole(otherOwner, "owner-1", "manager", ctx)).rejects.toMatchObject({ status: 409 });
    await expect(team.changeMemberStatus(otherOwner, "owner-1", "inactive", ctx)).rejects.toMatchObject({ status: 409 });
    await expect(team.removeMember(otherOwner, "owner-1", ctx)).rejects.toMatchObject({ status: 409 });
    expect(db.members.find((m) => m.id === "owner-1")).toMatchObject({ role: "owner", status: "active" });
  });

  it("with a second active owner, one owner may step another down", async () => {
    db.members.push({ id: "owner-2", name: "Co", email: "co@example.com", role: "owner", status: "active", invitedBy: null, lastLoginAt: null, createdAt: new Date() });
    await team.changeMemberRole(owner, "owner-2", "manager", ctx);
    expect(db.members.find((m) => m.id === "owner-2")!.role).toBe("manager");
  });

  it("nobody blocks or removes themselves", async () => {
    await expect(team.changeMemberStatus(owner, "owner-1", "blocked", ctx)).rejects.toMatchObject({ status: 403 });
    await expect(team.removeMember(owner, "owner-1", ctx)).rejects.toMatchObject({ status: 403 });
  });

  it("removing a member deletes the account, ends its sessions, and records who it was", async () => {
    await team.removeMember(owner, "m1", ctx);
    expect(db.members.find((m) => m.id === "m1")).toBeUndefined();
    expect(db.ended).toContain("m1");
    expect(db.audit.find((a) => a.action === "team.member.remove")?.metadata).toMatchObject({ email: "meera@example.com", role: "manager" });
  });
});
