import { ok, created } from "@/lib/server/http/response";
import { withErrorHandler } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { requireRole } from "@/lib/server/auth/dal";
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
  const input = validate(createInquirySchema, await readJson(request));
  const inquiry = await service.createInquiry(input, requestContext(request));
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
