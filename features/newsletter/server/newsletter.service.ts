import { randomUUID } from "node:crypto";

import { createMongoStore } from "@/lib/server/db/cms-store";
import { writeAuditLog } from "@/lib/server/audit/audit-log";
import { NotFoundError } from "@/lib/server/http/errors";
import { seedSubscribers } from "@/features/inquiries/lib/newsletter-repository";
import type { NewsletterSubscriber } from "@/types/inquiry";

import * as repo from "./newsletter.repository";
import type { SubscribeInput, UpdateSubscriberInput } from "./newsletter.validators";

interface RequestCtx {
  ip: string;
  userAgent: string;
  actorId?: string | null;
  actorEmail?: string;
}

/** One-time demo seed marker (idempotent; survives admin deletions). */
const seededFlag = createMongoStore<{ done: boolean }>({
  key: "newsletter-seeded",
  seed: () => ({ done: false }),
});

async function ensureSeeded(): Promise<void> {
  const flag = await seededFlag.read();
  if (flag.done) return;
  await repo.seedIfEmpty(seedSubscribers());
  await seededFlag.write({ done: true });
}

// ---- Public (storefront subscribe form) -----------------------------------

export async function subscribe(input: SubscribeInput, ctx: RequestCtx): Promise<NewsletterSubscriber> {
  const now = new Date().toISOString();
  const subscriber: NewsletterSubscriber = {
    // The server owns the identity and the timestamps. These used to fall back
    // to caller-supplied values, so an anonymous subscriber could choose its own
    // id — a collision surfaces as a 500 — and its own `createdAt`, pinning a
    // spam row above every real one in a list sorted newest-first.
    id: `sub-${randomUUID()}`,
    email: input.email.toLowerCase().trim(),
    isActive: input.isActive ?? true,
    source: input.source ?? "Website",
    createdAt: now,
    updatedAt: now,
  };

  const saved = await repo.subscribe(subscriber);
  await writeAuditLog({
    action: "newsletter.subscribe",
    actorEmail: saved.email,
    target: { type: "newsletter", id: saved.id },
    metadata: { source: saved.source },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return saved;
}

// ---- Admin ----------------------------------------------------------------

export async function getSubscribers(): Promise<NewsletterSubscriber[]> {
  await ensureSeeded();
  return repo.listAll();
}

export async function updateSubscriber(
  id: string,
  patch: UpdateSubscriberInput,
  ctx: RequestCtx,
): Promise<NewsletterSubscriber> {
  const existing = await repo.findById(id);
  if (!existing) throw new NotFoundError("Subscriber not found");

  const updated = await repo.patch(id, patch);
  await writeAuditLog({
    action: "newsletter.update",
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "newsletter", id },
    metadata: { ...patch },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return updated as NewsletterSubscriber;
}

export async function deleteSubscribers(ids: string[], ctx: RequestCtx): Promise<number> {
  const deleted = await repo.deleteMany(ids);
  await writeAuditLog({
    action: "newsletter.delete",
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "newsletter", id: ids.join(",") },
    metadata: { ids, deleted },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return deleted;
}
