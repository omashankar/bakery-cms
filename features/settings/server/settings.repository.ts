import { connectDB } from "@/lib/server/db/mongoose";
import { SettingsModel } from "@/lib/server/db/models/settings.model";
import {
  defaultAppSettings,
  isValidMapEmbedUrl,
  normalizeMapEmbedUrl,
} from "@/features/settings/lib/settings-utils";

/**
 * Settings repository — data access for the singleton settings document.
 * Seeds from the same `defaultAppSettings` the frontend uses, so a fresh
 * install matches the bakery template exactly.
 */

const SINGLETON = "singleton";

/**
 * Repairs values written before their contract existed.
 *
 * Tightening a Zod schema only constrains FUTURE writes. `contact.mapEmbedUrl`
 * was `z.string().trim().optional()` for the life of the project and the model
 * stores it as a bare `String`, so what is already in Mongo may be Google's
 * entire `<iframe …>` snippet — the paste that field invites — or, from an
 * admin-role API call, a `javascript:` URL. The storefront read path drops a bad
 * value defensively, but leaving it at rest means it comes back the moment
 * anything reads the section straight.
 *
 * Runs on the singleton read, saves only when it actually changed, and is
 * idempotent — a repaired document takes the early return on every later call.
 */
type SettingsDoc = NonNullable<Awaited<ReturnType<typeof SettingsModel.findOne>>>;

async function migrate(doc: SettingsDoc): Promise<SettingsDoc> {
  const stored = (doc.get("contact.mapEmbedUrl") as string | undefined) ?? "";
  if (!stored) return doc;

  const normalized = normalizeMapEmbedUrl(stored);
  const repaired = isValidMapEmbedUrl(normalized) ? normalized : "";
  if (repaired === stored) return doc;

  doc.set("contact.mapEmbedUrl", repaired);
  await doc.save();
  console.info(
    `[settings] repaired contact.mapEmbedUrl (${repaired ? "unwrapped" : "dropped as unsafe"})`,
  );
  return doc;
}

export async function getOrCreateSettings() {
  await connectDB();
  const existing = await SettingsModel.findOne({ key: SINGLETON });
  if (existing) return migrate(existing);

  return SettingsModel.create({
    key: SINGLETON,
    general: defaultAppSettings.general,
    contact: defaultAppSettings.contact,
    social: defaultAppSettings.social,
    security: defaultAppSettings.security,
    smtp: defaultAppSettings.smtp,
    analytics: defaultAppSettings.analytics,
    maintenance: defaultAppSettings.maintenance,
    commerce: defaultAppSettings.commerce,
    modules: defaultAppSettings.modules,
    labelOverrides: {},
  });
}

export async function updateSection(section: string, value: unknown) {
  // getOrCreate first so the return is always a live (non-null) document, and
  // set-by-path keeps the update strongly scoped to the one section.
  const doc = await getOrCreateSettings();
  doc.set(section, value);
  await doc.save();
  return doc;
}
