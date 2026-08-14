import { ok, created } from "@/lib/server/http/response";
import { withErrorHandler } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { requireRole } from "@/lib/server/auth/dal";
import { rateLimit } from "@/lib/server/http/rate-limit";
import { requestContext } from "@/lib/server/audit/audit-log";

import * as service from "./inquiry.service";
import {
  createInquirySchema,
  updateInquirySchema,
  deleteInquiriesSchema,
} from "./inquiry.validators";

const INQUIRY_ROLES = ["owner", "admin"] as const;
type IdContext = { params: Promise<{ id: string }> };

// ---- Public (contact form) ----

export const createInquiryController = withErrorHandler(async (request: Request) => {
  const ctx = requestContext(request);

  // Unauthenticated, and every submission lands in the queue a human works
  // through. Without a limit one script buries the shop's real enquiries — the
  // wedding form is where its largest orders come from. Login and password reset
  // already use this helper.
  const input = validate(createInquirySchema, await readJson(request));

  /**
   * Keyed on something the caller cannot rotate for free — the same rule the
   * login and password-reset throttles above were rewritten to.
   *
   * This was `ctx.ip` alone, and `ctx.ip` is "" on every deployment that has
   * not set TRUST_PROXY_HEADERS=true, which is the default. An empty string is
   * a CONSTANT, so the five-per-minute budget was not per visitor at all: it
   * was one bucket for the whole shop. Six people submitting in the same minute
   * meant the sixth got a 429, and on a busy Saturday the wedding form — where
   * this bakery's largest orders come from — simply stopped accepting anyone.
   *
   * The IP is still used when there IS one, as a second, narrower bucket.
   */
  rateLimit(`inquiry:from:${input.email.trim().toLowerCase()}`, { limit: 5, windowMs: 60_000 });
  if (ctx.ip) rateLimit(`inquiry:ip:${ctx.ip}`, { limit: 20, windowMs: 60_000 });
  const inquiry = await service.createInquiry(input, ctx);
  return created(inquiry, "Inquiry submitted");
});

// ---- Admin ----

export const listInquiriesController = withErrorHandler(async () => {
  await requireRole(...INQUIRY_ROLES);
  return ok(await service.getInquiries(), "Inquiries");
});

export const updateInquiryController = withErrorHandler(async (request: Request, ctx: IdContext) => {
  const session = await requireRole(...INQUIRY_ROLES);
  const { id } = await ctx.params;
  const patch = validate(updateInquirySchema, await readJson(request));
  const inquiry = await service.updateInquiry(id, patch, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(inquiry, "Inquiry updated");
});

export const deleteInquiriesController = withErrorHandler(async (request: Request) => {
  const session = await requireRole(...INQUIRY_ROLES);
  const { ids } = validate(deleteInquiriesSchema, await readJson(request));
  const deleted = await service.deleteInquiries(ids, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok({ deleted }, "Inquiries deleted");
});
