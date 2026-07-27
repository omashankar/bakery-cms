import { createMongoStore } from "@/lib/server/db/cms-store";
import { writeAuditLog } from "@/lib/server/audit/audit-log";
import { NotFoundError } from "@/lib/server/http/errors";
import { seedStore as seedSeoStore } from "@/features/seo/lib/seo-repository";
import { defaultHeaderSettings } from "@/features/site-layout/lib/header-utils";
import { defaultFooterSettings } from "@/features/site-layout/lib/footer-utils";
import { defaultAppearanceSettings } from "@/apps/admin/appearance/lib/appearance-utils";
import type { SeoStore } from "@/types/seo";
import type { HeaderSettings, FooterSettings } from "@/types/site-layout";
import type { AppearanceSettings } from "@/types/appearance";

/**
 * Site-layout singletons (SEO store, header, footer) that were client-only
 * localStorage values. Each is stored whole in the MongoDB-backed cms-store,
 * seeded on first read from the same defaults the client shipped. Reads are
 * public (storefront renders header/footer); writes are admin-only.
 */
const stores = {
  seo: createMongoStore<SeoStore>({ key: "seo", seed: seedSeoStore }),
  header: createMongoStore<HeaderSettings>({ key: "header", seed: () => defaultHeaderSettings }),
  footer: createMongoStore<FooterSettings>({ key: "footer", seed: () => defaultFooterSettings }),
  appearance: createMongoStore<AppearanceSettings>({
    key: "appearance",
    seed: () => defaultAppearanceSettings,
  }),
} as const;

export type SiteLayoutKey = keyof typeof stores;

export const SITE_LAYOUT_KEYS = Object.keys(stores) as SiteLayoutKey[];

function storeFor(key: string) {
  const store = stores[key as SiteLayoutKey];
  if (!store) throw new NotFoundError("Unknown site-layout section");
  return store;
}

export function getSiteLayout(key: string) {
  return storeFor(key).read();
}

export async function replaceSiteLayout(
  key: string,
  value: unknown,
  ctx: { ip: string; userAgent: string; actorId?: string | null; actorEmail?: string },
) {
  const store = storeFor(key);
  await store.write(value as never);
  await writeAuditLog({
    action: `site-layout.${key}.replace`,
    actorId: ctx.actorId ?? null,
    actorEmail: ctx.actorEmail,
    target: { type: "site-layout", id: key },
    metadata: {},
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return store.read();
}
