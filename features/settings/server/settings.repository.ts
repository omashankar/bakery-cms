import { connectDB } from "@/lib/server/db/mongoose";
import { SettingsModel } from "@/lib/server/db/models/settings.model";
import {
  defaultAppSettings,
  planSettingsRepairs,
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
  // The rules are pure and live in `planSettingsRepairs` so they can be tested
  // without a database; this only applies them.
  const repairs = planSettingsRepairs({
    contact: { mapEmbedUrl: doc.get("contact.mapEmbedUrl") as string | undefined },
    social: doc.get("social") as { href?: string; isActive?: boolean }[] | undefined,
  });

  if (repairs.length === 0) return doc;

  for (const repair of repairs) doc.set(repair.path, repair.value);

  try {
    await doc.save();
  } catch {
    // Two requests can read at once and both try to repair; the loser hits a
    // Mongoose VersionError on the concurrently-modified array. The other one
    // already wrote the same corrections — this is idempotent — so failing the
    // page over a race that resolved correctly would be the worse outcome. The
    // in-memory doc still carries the repairs, so this request renders safely.
    console.warn("[settings] repair not persisted (concurrent write); retrying on next read");
    return doc;
  }

  console.info(`[settings] repaired ${repairs.map((r) => r.reason).join(", ")}`);
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
