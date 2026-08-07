import type { BackupSnapshot } from "@/types/backup";
import type { AppSettings } from "@/types/settings";
import type { CatalogStore } from "@/types/catalog";
import {
  exportLocalStorageBackup,
  importLocalStorageBackup,
} from "@/features/settings/lib/settings-repository";
import { mergeAppSettings } from "@/features/settings/lib/settings-utils";
import { ensureSettingsHydrated } from "@/features/settings/lib/settings-repository";
import { ensureSiteLayoutHydrated } from "@/components/shared/site-layout-server-sync";
import { ensureSeoHydrated } from "@/features/site-layout/lib/site-layout-hydration";
import { ensureAdminConfigHydrated } from "@/features/admin-config/lib/admin-config-hydration";
import { ensureInvoiceSettingsHydrated } from "@/features/commerce/lib/use-invoice-settings-server-sync";
import {
  fetchFullSettings,
  pushSection,
  SERVER_SECTIONS,
} from "@/features/settings/lib/settings-api";
import {
  fetchCatalog,
  pushCatalogSection,
  CATALOG_SECTIONS,
} from "@/features/catalog/lib/catalog-api";
import {
  fetchHeaderSettings,
  replaceHeaderRequest,
  fetchFooterSettings,
  replaceFooterRequest,
  fetchAppearanceSettings,
  replaceAppearanceRequest,
  fetchSeoStore,
  replaceSeoRequest,
} from "@/features/site-layout/lib/site-layout-api";
import {
  fetchBanners,
  replaceBannersRequest,
  fetchTestimonials,
  replaceTestimonialsRequest,
  fetchFaqs,
  replaceFaqsRequest,
} from "@/features/content/lib/content-api";
import {
  fetchZones,
  restoreZonesRequest,
  fetchCoupons,
  replaceCouponsRequest,
} from "@/features/commerce/lib/commerce-api";
import {
  fetchInvoiceSettings,
  saveInvoiceSettingsRequest,
} from "@/features/commerce/lib/invoice-settings-api";
import {
  fetchPaymentGateways,
  replacePaymentGatewaysRequest,
  fetchPaymentNotifPrefs,
  replacePaymentNotifPrefsRequest,
  fetchAdminProfileConfig,
  replaceAdminProfileRequest,
  fetchCustomCode,
  replaceCustomCodeRequest,
} from "@/features/admin-config/lib/admin-config-api";

const STORAGE_KEY = "bakery-cms-backup-history";
const MAX_SNAPSHOTS = 8;
export const BACKUP_UPDATED_EVENT = "bakery-backup-updated";

/**
 * A CMS slice whose durable home is Mongo. The backup file still stores its
 * value under the matching localStorage key (so the file format stays
 * backward-compatible), but export reads the CURRENT server state and restore
 * PUSHES the snapshot back through the same dual-write client APIs the admin
 * already uses — so a restore survives the next page load instead of being
 * re-hydrated away by the server-sync hooks.
 */
interface ServerBackupSection {
  /** localStorage key this slice lives under in the backup file. */
  key: string;
  /** Human label for the UI. */
  title: string;
  /** Read the durable server value (null when unauthenticated/unreachable). */
  fetch: () => Promise<unknown | null>;
  /** Push a parsed value back to the server (best-effort, never throws). */
  push: (value: unknown) => Promise<boolean>;
  /**
   * Server value is a partial slice (settings/catalog) — overlay it onto the
   * local value for export so sibling fields (activity, updatedAt) survive.
   */
  mergeForExport?: (server: unknown, localParsed: unknown) => unknown;
}

/** Adapts a typed replace-request into the section's untyped push signature. */
function replacer<T>(fn: (value: T) => Promise<boolean>): (value: unknown) => Promise<boolean> {
  return (value) => fn(value as T);
}

/**
 * False when there was nothing recognisable to send.
 *
 * `[].every(Boolean)` is `true`, so a payload whose keys match no known
 * section reported a successful push having contacted the server zero
 * times — and the restore then listed it among the sections it had
 * restored. On the one screen where an admin cannot check by eye, that is
 * the worst direction to be wrong in.
 */
async function pushSettingsSections(value: unknown): Promise<boolean> {
  const record = (value ?? {}) as Record<string, unknown>;
  const present = SERVER_SECTIONS.filter((section) => record[section] !== undefined);
  if (present.length === 0) return false;

  const results = await Promise.all(
    present.map((section) => pushSection(section, record[section]))
  );
  return results.every(Boolean);
}

async function pushCatalogSections(value: unknown): Promise<boolean> {
  const record = (value ?? {}) as Record<string, unknown>;
  const results = await Promise.all(
    CATALOG_SECTIONS.filter((section) => record[section] !== undefined).map((section) =>
      pushCatalogSection(section, record[section])
    )
  );
  return results.every(Boolean);
}

/**
 * The single source of truth for which slices round-trip through the server.
 * Anything NOT listed here stays browser-only on restore (homepage/wedding
 * builders, media library, products/cakes, pages, orders/inquiries/newsletter/
 * reviews collections, security center) — see BROWSER_ONLY_NOTE.
 */
const SERVER_BACKUP_SECTIONS: ServerBackupSection[] = [
  {
    key: "bakery-cms-settings",
    title: "Settings",
    fetch: fetchFullSettings,
    push: pushSettingsSections,
    mergeForExport: (server, local) =>
      mergeAppSettings({
        ...(local as Partial<AppSettings>),
        ...(server as Partial<AppSettings>),
      }),
  },
  {
    key: "bakery-cms-catalog",
    title: "Catalog",
    fetch: fetchCatalog,
    push: pushCatalogSections,
    mergeForExport: (server, local) => ({
      ...(local as Partial<CatalogStore>),
      ...(server as Partial<CatalogStore>),
    }),
  },
  { key: "bakery-cms-header", title: "Header", fetch: fetchHeaderSettings, push: replacer(replaceHeaderRequest) },
  { key: "bakery-cms-footer", title: "Footer", fetch: fetchFooterSettings, push: replacer(replaceFooterRequest) },
  {
    key: "bakery-cms-appearance",
    title: "Appearance",
    fetch: fetchAppearanceSettings,
    push: replacer(replaceAppearanceRequest),
  },
  { key: "bakery-cms-seo", title: "SEO", fetch: fetchSeoStore, push: replacer(replaceSeoRequest) },
  { key: "bakery-cms-banners", title: "Banners", fetch: fetchBanners, push: replacer(replaceBannersRequest) },
  {
    key: "bakery-cms-testimonials",
    title: "Testimonials",
    fetch: fetchTestimonials,
    push: replacer(replaceTestimonialsRequest),
  },
  { key: "bakery-cms-faq", title: "FAQ", fetch: fetchFaqs, push: replacer(replaceFaqsRequest) },
  {
    key: "bakery-cms-delivery-zones",
    title: "Delivery zones",
    fetch: fetchZones,
    // restore, not save: a bare replaceZonesRequest sends no knownIds and so
    // deletes nothing, leaving rows the backup does not contain.
    push: replacer(restoreZonesRequest),
  },
  { key: "bakery-cms-coupons", title: "Coupons", fetch: fetchCoupons, push: replacer(replaceCouponsRequest) },
  {
    key: "bakery-cms-invoice-settings",
    title: "Invoice settings",
    fetch: fetchInvoiceSettings,
    push: replacer(saveInvoiceSettingsRequest),
  },
  {
    key: "bakery-cms-payment-gateways",
    title: "Payment gateways",
    fetch: fetchPaymentGateways,
    push: replacer(replacePaymentGatewaysRequest),
  },
  {
    key: "bakery-cms-payment-notif-prefs",
    title: "Payment notifications",
    fetch: fetchPaymentNotifPrefs,
    push: replacer(replacePaymentNotifPrefsRequest),
  },
  {
    key: "bakery-cms-admin-profile",
    title: "Admin profile",
    fetch: fetchAdminProfileConfig,
    push: replacer(replaceAdminProfileRequest),
  },
  {
    key: "bakery-cms-custom-code",
    title: "Custom code",
    fetch: fetchCustomCode,
    push: replacer(replaceCustomCodeRequest),
  },
];

/** Keys that a restore actually pushes back to Mongo (used by the UI). */
export const serverBackedKeys: readonly string[] = SERVER_BACKUP_SECTIONS.map((s) => s.key);

/** UI copy shown next to browser-only slices. */
export const BROWSER_ONLY_NOTE =
  "Homepage & wedding builders, media library, products, pages, orders, inquiries, newsletter, reviews and the security center restore to this browser only — they have no whole-value server replace endpoint.";

export interface RestoreResult {
  /** localStorage keys written. */
  localCount: number;
  /** Titles of the slices the server ACCEPTED. */
  serverSections: string[];
  /** Titles the server refused — restored in this browser only. */
  failedSections: string[];
  /**
   * Whether every hydration gate opened before the push.
   *
   * A guarded PUT refuses before any request leaves the browser when its
   * gate is shut, and that refusal is indistinguishable from the server
   * saying no — so a restore from a cold or signed-out tab blamed the
   * server for sections it never contacted. The screen needs to tell those
   * two apart, because they have completely different remedies.
   */
  gatesOpen: boolean;
}

function nowIso(): string {
  return new Date().toISOString();
}

function notify(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(BACKUP_UPDATED_EVENT));
}

function persist(snapshots: BackupSnapshot[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
  notify();
}

export function loadBackupHistory(): BackupSnapshot[] {
  if (typeof window === "undefined") return [];

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as BackupSnapshot[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function estimateSize(data: Record<string, string | null>): number {
  return JSON.stringify(data).length;
}

export function createBackupSnapshot(
  data: Record<string, string | null>,
  label?: string
): BackupSnapshot {
  const snapshot: BackupSnapshot = {
    id: `backup-${Date.now()}`,
    label: label ?? `Backup ${new Date().toLocaleString()}`,
    createdAt: nowIso(),
    keyCount: Object.keys(data).length,
    sizeBytes: estimateSize(data),
    data,
  };

  const history = [snapshot, ...loadBackupHistory()].slice(0, MAX_SNAPSHOTS);
  persist(history);
  return snapshot;
}

export function deleteBackupSnapshot(id: string): boolean {
  const history = loadBackupHistory();
  const next = history.filter((item) => item.id !== id);
  if (next.length === history.length) return false;
  persist(next);
  return true;
}

/** A backup, plus the slices whose server copy could not be read for it. */
export interface ServerBackupData {
  data: Record<string, string | null>;
  /**
   * Titles the server did not answer for.
   *
   * These fell back to whatever this browser held — which on a cold or
   * unauthenticated load is the DEMO SEED. The fallback itself is reasonable;
   * calling the result a server backup without saying so is not, because the
   * file is then restored months later over the real thing by someone who has
   * no way left to tell which slices were ever real.
   */
  unavailableSections: string[];
}

/**
 * Build a backup that reflects Mongo, not just this browser. Starts from the
 * localStorage snapshot, then overlays the CURRENT server value for every
 * server-backed slice (falling back to localStorage when the server has none,
 * and reporting which those were).
 */
export async function buildServerBackup(): Promise<ServerBackupData> {
  const base = exportLocalStorageBackup();
  const unavailableSections: string[] = [];

  await Promise.all(
    SERVER_BACKUP_SECTIONS.map(async (section) => {
      const server = await section.fetch();
      if (server == null) {
        // Keep whatever localStorage had, and SAY so.
        unavailableSections.push(section.title);
        return;
      }

      let value: unknown = server;
      if (section.mergeForExport) {
        const raw = base[section.key];
        let localParsed: unknown;
        if (raw) {
          try {
            localParsed = JSON.parse(raw);
          } catch {
            localParsed = undefined;
          }
        }
        value = section.mergeForExport(server, localParsed);
      }
      base[section.key] = JSON.stringify(value);
    })
  );

  return { data: base, unavailableSections };
}

/** The data alone, for callers that do not surface the gaps. */
export async function buildServerBackupData(): Promise<Record<string, string | null>> {
  return (await buildServerBackup()).data;
}

/**
 * Push every server-backed slice found in the snapshot back through the same
 * dual-write client APIs the admin uses, so the restore persists to Mongo and
 * survives reload.
 *
 * THE SERVER GOES FIRST. This used to call `importLocalStorageBackup(data)`
 * before pushing anything, and a section the server then REFUSED was left
 * sitting in the local cache anyway. That is not merely cosmetic: every form in
 * this admin writes its whole section back from that cache, so the next time
 * anyone edited one field of a refused section, the replace-all carried the
 * rejected restore payload to the server. A restore the admin was told had
 * failed landed later, by the back door, with nothing connecting the two.
 *
 * So a server-backed key is written locally only once the server has taken it.
 * Browser-only keys — the builders, media, products, the security centre, which
 * have no whole-value endpoint — are written either way, because for them the
 * browser IS the destination.
 */
/**
 * Opens every gate a restore will push through, before it pushes anything.
 *
 * Each guarded PUT waits out the full hydration deadline when its gate is
 * shut, and a restore writes sixteen sections in sequence — so a restore from
 * a tab that never hydrated took minutes and then reported the server as
 * having refused, which it never did. Opening them here rather than at the
 * call site means the function cannot be used wrongly.
 *
 * Failures are ignored on purpose: a gate that will not open is exactly the
 * case the per-section refusal reporting already handles honestly.
 */
async function openEveryGate(): Promise<boolean> {
  const results = await Promise.allSettled([
    ensureSettingsHydrated(),
    ensureSiteLayoutHydrated(),
    ensureSeoHydrated(),
    ensureAdminConfigHydrated(),
    ensureInvoiceSettingsHydrated(),
  ]);

  // An opener that rejected, or resolved false, means its gate is still
  // shut — and every write behind it will refuse without contacting the
  // server.
  return results.every(
    (result) => result.status === "fulfilled" && result.value !== false,
  );
}

export async function restoreBackupToServer(
  data: Record<string, string | null>
): Promise<RestoreResult> {
  const gatesOpen = await openEveryGate();

  const serverSections: string[] = [];
  const failedSections: string[] = [];
  const accepted: Record<string, string | null> = {};

  for (const section of SERVER_BACKUP_SECTIONS) {
    const raw = data[section.key];
    if (raw == null) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }

    // Only count a section as restored once the SERVER has it. A restore is
    // exactly when an admin is least able to check by eye, and listing a section
    // that never landed is how a backup gets trusted that never came back.
    if (await section.push(parsed)) {
      serverSections.push(section.title);
      accepted[section.key] = raw;
    } else {
      failedSections.push(section.title);
    }
  }

  const browserOnly = Object.fromEntries(
    Object.entries(data).filter(([key]) => !serverBackedKeys.includes(key)),
  );

  const localCount = importLocalStorageBackup({ ...browserOnly, ...accepted });

  return { localCount, serverSections, failedSections, gatesOpen };
}

export async function restoreBackupSnapshotToServer(
  id: string
): Promise<RestoreResult | null> {
  const snapshot = loadBackupHistory().find((item) => item.id === id);
  if (!snapshot) return null;
  return restoreBackupToServer(snapshot.data);
}

/**
 * Snapshot the CURRENT durable state (server + localStorage), archive it to
 * history, and return it. Used both for the downloadable export and for the
 * "safety" rollback point captured before an import.
 */
export async function exportAndArchiveServerBackup(
  label?: string,
): Promise<{ snapshot: BackupSnapshot; unavailableSections: string[] }> {
  const { data, unavailableSections } = await buildServerBackup();
  return { snapshot: createBackupSnapshot(data, label), unavailableSections };
}

/** Legacy localStorage-only snapshot (kept for callers that need a sync path). */
export function exportAndArchiveBackup(label?: string): BackupSnapshot {
  const data = exportLocalStorageBackup();
  return createBackupSnapshot(data, label);
}

/** Legacy localStorage-only restore (superseded by restoreBackupSnapshotToServer). */
export function restoreBackupSnapshot(id: string): number {
  const snapshot = loadBackupHistory().find((item) => item.id === id);
  if (!snapshot) return 0;
  return importLocalStorageBackup(snapshot.data);
}

export function formatBackupSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
