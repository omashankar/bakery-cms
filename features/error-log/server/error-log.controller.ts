import { z } from "zod";

import { ok } from "@/lib/server/http/response";
import { NotFoundError, withErrorHandler } from "@/lib/server/http/errors";
import { readJson, validate } from "@/lib/server/http/validate";
import { rateLimit } from "@/lib/server/http/rate-limit";
import { requestContext } from "@/lib/server/audit/audit-log";
import { requirePermission } from "@/lib/server/auth/access";
import { connectDB } from "@/lib/server/db/mongoose";
import { ErrorLogModel } from "@/lib/server/db/models/error-log.model";
import { recordError } from "@/lib/server/errors/record-error";

import type { ErrorLogView } from "../lib/error-log-types";

type IdContext = { params: Promise<{ id: string }> };

const browserReportSchema = z.object({
  message: z.string().trim().min(1).max(500),
  stack: z.string().max(4000).optional(),
  path: z.string().max(300).optional(),
  digest: z.string().max(100).optional(),
});

/**
 * A page crashed in a visitor's browser — the error boundary reports it here.
 *
 * Open to anyone, because a customer is who sees most crashes; so it is
 * throttled per address, size-capped, and writes only into the error log.
 */
export const reportBrowserErrorController = withErrorHandler(async (request: Request) => {
  const { ip, userAgent } = requestContext(request);
  rateLimit(`error-report:${ip || "unknown"}`, { limit: 10, windowMs: 10 * 60_000 });
  const report = validate(browserReportSchema, await readJson(request));
  await recordError({ source: "browser", kind: "browser", ...report, userAgent });
  return ok(null, "Recorded");
});

export function toErrorLogView(doc: {
  _id: unknown;
  source: string;
  kind: string;
  message: string;
  stack: string;
  path: string;
  method: string;
  route: string;
  digest: string;
  count: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolvedAt: Date | null;
}): ErrorLogView {
  return {
    id: String(doc._id),
    source: doc.source === "browser" ? "browser" : "server",
    kind: doc.kind,
    message: doc.message,
    stack: doc.stack,
    path: doc.path || doc.route,
    method: doc.method,
    digest: doc.digest,
    count: doc.count,
    firstSeenAt: new Date(doc.firstSeenAt).toISOString(),
    lastSeenAt: new Date(doc.lastSeenAt).toISOString(),
    resolvedAt: doc.resolvedAt ? new Date(doc.resolvedAt).toISOString() : null,
  };
}

/** Newest first; the open ones are what matter, so they lead. */
export async function listErrorLog(): Promise<ErrorLogView[]> {
  await connectDB();
  const docs = await ErrorLogModel.find({}).sort({ resolvedAt: 1, lastSeenAt: -1 }).limit(200).lean();
  return docs.map(toErrorLogView);
}

export const listErrorsController = withErrorHandler(async () => {
  await requirePermission("security.view");
  return ok(await listErrorLog(), "Error log");
});

/** "Dealt with" — it leaves the open list until it happens again. */
export const resolveErrorController = withErrorHandler(async (_request: Request, ctx: IdContext) => {
  await requirePermission("security.manage");
  const { id } = await ctx.params;
  if (!/^[0-9a-f]{24}$/i.test(id)) throw new NotFoundError("That error is not in the log.");
  await connectDB();
  const doc = await ErrorLogModel.findByIdAndUpdate(id, { $set: { resolvedAt: new Date() } }, { returnDocument: "after" }).lean();
  if (!doc) throw new NotFoundError("That error is not in the log.");
  return ok(toErrorLogView(doc), "Marked as fixed");
});
