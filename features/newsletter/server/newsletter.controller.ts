import { ok, created } from "@/lib/server/http/response";
import { withErrorHandler } from "@/lib/server/http/errors";
import { validate, readJson } from "@/lib/server/http/validate";
import { requireRole } from "@/lib/server/auth/dal";
import { requestContext } from "@/lib/server/audit/audit-log";
import { rateLimit } from "@/lib/server/http/rate-limit";

import * as service from "./newsletter.service";
import {
  subscribeSchema,
  updateSubscriberSchema,
  deleteSubscribersSchema,
} from "./newsletter.validators";

const NEWSLETTER_ROLES = ["owner", "admin"] as const;
type IdContext = { params: Promise<{ id: string }> };

// ---- Public (subscribe form) ----

export const subscribeController = withErrorHandler(async (request: Request) => {
  const ctx = requestContext(request);
  const input = validate(subscribeSchema, await readJson(request));

  /**
   * The one anonymous write in this family with no limit at all.
   *
   * Its inquiry and review siblings both throttle, on the same stated
   * reasoning: an unauthenticated endpoint that appends a row a human later
   * reads. The subscriber list is capped, so past that cap a script filling it
   * means real subscribers stop appearing.
   */
  rateLimit(`newsletter:from:${input.email.trim().toLowerCase()}`, { limit: 5, windowMs: 60_000 });
  if (ctx.ip) rateLimit(`newsletter:ip:${ctx.ip}`, { limit: 20, windowMs: 60_000 });

  const subscriber = await service.subscribe(input, ctx);
  return created(subscriber, "Subscribed");
});

// ---- Admin ----

export const listSubscribersController = withErrorHandler(async () => {
  await requireRole(...NEWSLETTER_ROLES);
  return ok(await service.getSubscribers(), "Subscribers");
});

export const updateSubscriberController = withErrorHandler(async (request: Request, ctx: IdContext) => {
  const session = await requireRole(...NEWSLETTER_ROLES);
  const { id } = await ctx.params;
  const patch = validate(updateSubscriberSchema, await readJson(request));
  const subscriber = await service.updateSubscriber(id, patch, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok(subscriber, "Subscriber updated");
});

export const deleteSubscribersController = withErrorHandler(async (request: Request) => {
  const session = await requireRole(...NEWSLETTER_ROLES);
  const { ids } = validate(deleteSubscribersSchema, await readJson(request));
  const deleted = await service.deleteSubscribers(ids, {
    ...requestContext(request),
    actorId: session.sub,
    actorEmail: session.email,
  });
  return ok({ deleted }, "Subscribers deleted");
});
