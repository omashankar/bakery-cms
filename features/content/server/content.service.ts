import { createMongoStore } from "@/lib/server/db/cms-store";
import { writeAuditLog } from "@/lib/server/audit/audit-log";
import { NotFoundError } from "@/lib/server/http/errors";
import { defaultBanners } from "@/features/content/lib/banners-utils";
import { seedFromLanding as seedTestimonials } from "@/features/content/lib/testimonials-repository";
import { seedFromLanding as seedFaqs } from "@/features/content/lib/faq-repository";
import type { Banner } from "@/types/media";
import type { Testimonial, FaqItem } from "@/types/content";

/**
 * Content collections (banners, testimonials, FAQ) that were client-only
 * localStorage arrays. Each is stored whole in the MongoDB-backed cms-store,
 * seeded on first read from the same defaults the client shipped.
 */
const stores = {
  banners: createMongoStore<Banner[]>({ key: "banners", seed: () => defaultBanners }),
  testimonials: createMongoStore<Testimonial[]>({ key: "testimonials", seed: seedTestimonials }),
  faq: createMongoStore<FaqItem[]>({ key: "faq", seed: seedFaqs }),
} as const;

export type ContentKey = keyof typeof stores;

export const CONTENT_KEYS = Object.keys(stores) as ContentKey[];

function storeFor(key: string) {
  const store = stores[key as ContentKey];
  if (!store) throw new NotFoundError("Unknown content collection");
  return store;
}

export function getContent(key: string) {
  return storeFor(key).read();
}

export async function replaceContent(
  key: string,
  items: unknown[],
  ctx: { ip: string; userAgent: string; actorId?: string | null; actorEmail?: string },
) {
  const store = storeFor(key);
  await store.write(items as never);
  await writeAuditLog({
    action: `content.${key}.replace`,
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "content", id: key },
    metadata: { count: items.length },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return store.read();
}
