import { randomUUID } from "node:crypto";

import { createMongoStore } from "@/lib/server/db/cms-store";
import { writeAuditLog } from "@/lib/server/audit/audit-log";
import { NotFoundError } from "@/lib/server/http/errors";
import { seedInquiries } from "@/features/inquiries/lib/inquiries-repository";
import type { Inquiry } from "@/types/inquiry";

import * as repo from "./inquiry.repository";
import type { CreateInquiryInput, UpdateInquiryInput } from "./inquiry.validators";

interface RequestCtx {
  ip: string;
  userAgent: string;
  actorId?: string | null;
  actorEmail?: string;
}

/**
 * One-time demo seed marker. The 12 sample inquiries are inserted on the first
 * admin read so the list is populated as before; the flag makes it idempotent
 * and — crucially — prevents deleted demo inquiries from resurrecting.
 */
const seededFlag = createMongoStore<{ done: boolean }>({
  key: "inquiries-seeded",
  seed: () => ({ done: false }),
});

async function ensureSeeded(): Promise<void> {
  const flag = await seededFlag.read();
  if (flag.done) return;
  await repo.seedIfEmpty(seedInquiries());
  await seededFlag.write({ done: true });
}

// ---- Public (storefront contact form) -------------------------------------

export async function createInquiry(input: CreateInquiryInput, ctx: RequestCtx): Promise<Inquiry> {
  const now = new Date().toISOString();
  const inquiry: Inquiry = {
    id: input.id ?? `inq-${randomUUID()}`,
    type: input.type,
    name: input.name,
    email: input.email,
    phone: input.phone,
    subject: input.subject,
    message: input.message,
    status: input.status ?? "new",
    eventDate: input.eventDate,
    guestCount: input.guestCount,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };

  await repo.create(inquiry);
  await writeAuditLog({
    action: "inquiry.create",
    actorEmail: inquiry.email,
    target: { type: "inquiry", id: inquiry.id },
    metadata: { type: inquiry.type, subject: inquiry.subject },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return inquiry;
}

// ---- Admin ----------------------------------------------------------------

export async function getInquiries(): Promise<Inquiry[]> {
  await ensureSeeded();
  return repo.listAll();
}

export async function updateInquiry(
  id: string,
  patch: UpdateInquiryInput,
  ctx: RequestCtx,
): Promise<Inquiry> {
  const existing = await repo.findById(id);
  if (!existing) throw new NotFoundError("Inquiry not found");

  const updated = await repo.patch(id, patch);
  await writeAuditLog({
    action: "inquiry.update",
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "inquiry", id },
    metadata: { ...patch },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return updated as Inquiry;
}

export async function deleteInquiries(ids: string[], ctx: RequestCtx): Promise<number> {
  const deleted = await repo.deleteMany(ids);
  await writeAuditLog({
    action: "inquiry.delete",
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "inquiry", id: ids.join(",") },
    metadata: { ids, deleted },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return deleted;
}
