import { createMongoStore } from "@/lib/server/db/cms-store";
import { writeAuditLog } from "@/lib/server/audit/audit-log";
import { NotFoundError } from "@/lib/server/http/errors";
import { defaultBanners, getBannerScheduleState } from "@/features/content/lib/banners-utils";
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

/**
 * What a visitor may see, as opposed to what the admin manages.
 *
 * The read on /api/content/[key] is public, because the storefront hydrates
 * these three collections in the browser. It was returning the WHOLE stored
 * array: every testimonial the admin had not approved, every unpublished FAQ,
 * and every banner that was switched off, expired, or scheduled — including its
 * start date, which is the launch time of a campaign the shop has not announced.
 * None of that is needed to render the shop.
 *
 * The admin still gets everything; it asks as an authenticated caller.
 */
export async function getPublicContent(key: string) {
  const items = await storeFor(key).read();

  if (key === "banners") {
    return (items as Banner[]).filter((banner) => getBannerScheduleState(banner) === "live");
  }
  if (key === "testimonials") {
    return (items as Testimonial[]).filter((item) => item.status === "published");
  }
  if (key === "faq") {
    return (items as FaqItem[]).filter((item) => item.status === "published");
  }
  return items;
}

/** The stored list and the version a save must carry back. */
export function getContentVersioned(key: string) {
  return storeFor(key).readVersioned();
}

/**
 * Replace the whole collection.
 *
 * These endpoints are replace-all: a save sends the entire list. Without a
 * version to compare, a second admin tab — or the same tab left open — sent its
 * older list and silently reverted everything done in between, while both tabs
 * reported success. The hydration gate stops a write from a browser that never
 * loaded the server copy; this stops one from a browser whose copy has aged.
 */
export async function replaceContent(
  key: string,
  items: unknown[],
  ctx: { ip: string; userAgent: string; actorId?: string | null; actorEmail?: string },
  expectedVersion?: number,
) {
  const store = storeFor(key);
  await store.writeVersioned(items as never, expectedVersion);
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
