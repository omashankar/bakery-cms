import { randomUUID } from "node:crypto";

import { writeAuditLog } from "@/lib/server/audit/audit-log";
import { NotFoundError } from "@/lib/server/http/errors";
import type { Inquiry } from "@/types/inquiry";

import * as repo from "./inquiry.repository";
import type { CreateInquiryInput, UpdateInquiryInput } from "./inquiry.validators";

interface RequestCtx {
  ip: string;
  userAgent: string;
  actorId?: string | null;
  actorEmail?: string;
}

/*
  No demo seed. The first admin read used to insert sample rows for real —
  addresses at email.com, a real mail provider, most of them "active" — so a
  new shop's "Copy emails" pasted strangers into its first campaign, and its
  inbox opened on invented wedding leads. The reviews service dropped its seed
  for the same reason. An empty list is the honest answer for a new shop.
*/

// ---- Public (storefront contact form) -------------------------------------

export async function createInquiry(input: CreateInquiryInput, ctx: RequestCtx): Promise<Inquiry> {
  const now = new Date().toISOString();
  const inquiry: Inquiry = {
    // Minted here, never taken from the body. See `createInquirySchema`.
    id: `inq-${randomUUID()}`,
    type: input.type,
    name: input.name,
    email: input.email,
    phone: input.phone,
    subject: input.subject,
    message: input.message,
    // Forced. A public submission is a new enquiry and nothing else — accepting
    // "closed" let a stranger file one the shop would never look at.
    status: "new",
    eventDate: input.eventDate,
    guestCount: input.guestCount,
    productSlug: input.productSlug,
    createdAt: now,
    updatedAt: now,
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

/**
 * The questions this product has public answers to.
 *
 * Public: no session, and the projection in the repository is what keeps the
 * asker’s contact details out of the response.
 */
export function getAnsweredProductQuestions(productSlug: string): Promise<Inquiry[]> {
  return repo.listAnsweredForProduct(productSlug);
}

// ---- Admin ----------------------------------------------------------------

export async function getInquiries(): Promise<Inquiry[]> {
  return repo.listAll();
}

export async function updateInquiry(
  id: string,
  patch: UpdateInquiryInput,
  ctx: RequestCtx,
): Promise<Inquiry> {
  const existing = await repo.findById(id);
  if (!existing) throw new NotFoundError("Inquiry not found");

  /**
   * Writing an answer stamps WHEN, and moves the enquiry on.
   *
   * The product page sorts answered questions by `answeredAt`, so an answer
   * without one sorts as if it had never been given. And an admin who has just
   * answered somebody has replied to them — leaving the status at "new" would
   * keep the question in the queue they are working through.
   *
   * Clearing an answer — the admin thinking better of it — takes the stamp with
   * it, so the row stops being public rather than becoming a blank answer.
   */
  const answered =
    typeof patch.answer === "string"
      ? patch.answer.trim()
        ? { answeredAt: new Date().toISOString(), status: patch.status ?? ("replied" as const) }
        : { answeredAt: undefined }
      : {};

  const updated = await repo.patch(id, { ...patch, ...answered });
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
