import type {
  ActivityLog,
  AnalyticsSettings,
  AppSettings,
  CommerceSettings,
  ContactSettings,
  GeneralSettings,
  MaintenanceSettings,
  LabelOverrides,
  ModuleSettings,
  SecuritySettings,
  SmtpSettings,
  SocialLinkSettings,
} from "@/types/settings";
import {
  createActivityEntry,
  defaultAnalyticsSettings,
  defaultAppSettings,
  defaultCommerceSettings,
  defaultContactSettings,
  defaultGeneralSettings,
  defaultMaintenanceSettings,
  defaultLabelOverrides,
  defaultModuleSettings,
  defaultSecuritySettings,
  defaultSmtpSettings,
  defaultSocialLinks,
  mergeAppSettings,
} from "./settings-utils";
import {
  fetchFullSettings,
  fetchPublicSettings,
  pushSection,
  resetSectionRequest,
  SERVER_SECTIONS,
  settingsHydration,
} from "./settings-api";
import { writeLocalJson } from "@/lib/browser-storage";

const STORAGE_KEY = "bakery-cms-settings";
const MAX_ACTIVITY = 100;
export const SETTINGS_UPDATED_EVENT = "bakery-settings-updated";

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * What actually goes into localStorage — never the mail password.
 *
 * The SERVER stopped handing this out (`redactMailPassword`), and its comment
 * lists exactly why: the password "was written to `localStorage` by the
 * settings store, survived logout (only the session key is cleared), rode along
 * to every device that admin signed in from, was readable by any script on any
 * admin page, and was swept into every downloadable backup file". Redacting the
 * READ left the other end of that list open — the admin TYPES it into the SMTP
 * form, and every one of those consequences followed from the save.
 *
 * The value still reaches the server: `updateStore` pushes from the in-memory
 * object, and only the cached copy is scrubbed. A blank password means "keep
 * the stored one" on the way back in, so nothing is lost by not holding it.
 */
function scrubbedForCache(settings: AppSettings): AppSettings {
  if (!settings.smtp?.password) return settings;
  return { ...settings, smtp: { ...settings.smtp, password: "" } };
}

function persist(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  // Never throws. `loadSettings` seeds through here on first read, and
  // `getCommerceSettings` is called from `generateOrderNumber` — so on a browser
  // at its storage limit this was the SECOND way a checkout died before the
  // order reached the server, after the order cache itself.
  writeLocalJson(STORAGE_KEY, scrubbedForCache(settings));
  window.dispatchEvent(new CustomEvent(SETTINGS_UPDATED_EVENT));
}

function parseSettings(raw: string): AppSettings | null {
  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    if (!parsed?.general?.siteName) return null;
    return mergeAppSettings(parsed);
  } catch {
    return null;
  }
}

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return defaultAppSettings;

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    persist(defaultAppSettings);
    return defaultAppSettings;
  }

  return parseSettings(raw) ?? defaultAppSettings;
}

export function saveSettings(settings: AppSettings): AppSettings {
  const next: AppSettings = {
    ...settings,
    updatedAt: nowIso(),
  };
  persist(next);
  return next;
}

export function resetSettings(): AppSettings {
  if (typeof window !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
    persist(defaultAppSettings);
  }
  return defaultAppSettings;
}

function appendActivity(
  settings: AppSettings,
  action: string,
  entity: string,
  details?: string
): AppSettings {
  const entry = createActivityEntry(action, entity, details);
  const activity = [entry, ...settings.activity].slice(0, MAX_ACTIVITY);
  return { ...settings, activity, updatedAt: nowIso() };
}

/**
 * Reads the server's settings into the local store, and opens the hydration
 * gate if that read was the full, authenticated one.
 *
 * Server values are deep-merged OVER the local ones, so a section the server
 * omits keeps its existing value. `saveSettings` fires SETTINGS_UPDATED_EVENT,
 * which every live consumer already listens to.
 */
export async function hydrateSettingsFromServer(
  options: {
    /**
     * Whether to try the admin-only read first.
     *
     * False on the storefront. `/api/settings` requires a settings role, so for
     * a visitor it can only ever answer 401 — two of them on every page view,
     * two red lines in every customer's console, and a `noteAuthStatus(401)`
     * that pushed the session tracker into "checking" on a page with no session
     * to check. The public subset that follows is what the storefront actually
     * uses, and it is unauthenticated by design.
     *
     * This is the same reasoning that already keeps `SiteLayoutServerSync` out
     * of the root providers — see the note in components/providers/app-providers.
     *
     * It costs the storefront nothing else: only a FULL read opens the
     * hydration gate, and the gate is opened on demand by
     * `ensureSettingsHydrated` before any write, never by this mount.
     */
    privileged?: boolean;
  } = {},
): Promise<boolean> {
  const full = options.privileged === false ? null : await fetchFullSettings();
  const server = full ?? (await fetchPublicSettings());
  if (!server) return false;

  const current = loadSettings();
  const merged = mergeAppSettings({
    ...current,
    general: { ...current.general, ...(server.general ?? {}) },
    contact: { ...current.contact, ...(server.contact ?? {}) },
    social: server.social ?? current.social,
    security: { ...current.security, ...(server.security ?? {}) },
    smtp: { ...current.smtp, ...(server.smtp ?? {}) },
    analytics: { ...current.analytics, ...(server.analytics ?? {}) },
    maintenance: { ...current.maintenance, ...(server.maintenance ?? {}) },
    commerce: {
      ...current.commerce,
      ...(server.commerce ?? {}),
      paymentMethods: {
        ...current.commerce.paymentMethods,
        ...(server.commerce?.paymentMethods ?? {}),
      },
    },
    modules: { ...current.modules, ...(server.modules ?? {}) },
    // The shop's own words. This list is rebuilt BY HAND, so a section missing
    // from it is discarded on every hydrate — which is precisely how
    // `labelOverrides` stayed inert while the server resolved it correctly.
    labelOverrides: { ...current.labelOverrides, ...(server.labelOverrides ?? {}) },
    // Activity is a client-only convenience log; the server uses audit_logs.
    activity: current.activity,
  });

  saveSettings(merged);

  // Only a FULL read may open the gate: the public subset carries no
  // smtp/security/analytics, so settling on it would still let those sections
  // be pushed as this browser's seed.
  if (full) settingsHydration.markSettled();
  return Boolean(full);
}

/**
 * Guarantees the local copy came from the server before anything is written back.
 *
 * The gate used to have exactly one opener: a `[]`-dep effect in the root
 * layout. An admin who signs in through the LOGIN FORM loads that layout while
 * anonymous — so `/api/settings` 401s and the gate stays shut — and then reaches
 * the admin by `router.push`, a soft navigation that never remounts the layout.
 * The effect never ran again, so the gate stayed shut for the entire session and
 * every settings save in the app failed with "saved on this device only". Being
 * able to open it on demand is what makes the gate safe to depend on.
 */
export async function ensureSettingsHydrated(): Promise<boolean> {
  if (settingsHydration.hasSettled()) return true;
  return hydrateSettingsFromServer();
}

/**
 * The commerce section, but only once the server's copy is actually in it.
 *
 * A section PUT is a replace-all, and `updateStore`'s own comment is explicit
 * about the limit of the gate it waits on: it protects the sections NOT in the
 * patch, and "the section that IS in `patch` came from the caller — protecting
 * that one is the form's job". Every settings FORM does that job, by staying
 * behind a skeleton until hydration lands. `setGatewayEnabled` is not a form:
 * it read `getCommerceSettings()` synchronously and only then awaited, so the
 * whole commerce object was frozen before anything had been read from the
 * server — and one click on the Cash-on-Delivery switch PUT that frozen copy
 * back. On a cache as old as the last page load that silently reverts the
 * delivery fee, the free-delivery threshold, the tax rate and label, gift wrap,
 * the minimum order value, the order-number prefix, the checkout terms and the
 * delivery time slots to whatever this browser last saw; on a genuinely empty
 * one it writes the demo seed. The toast said "Gateway disabled" either way.
 *
 * `null` means hydration never settled, and then the caller must send nothing
 * and report the refusal — the same shape as `readHydratedCoupons`, which this
 * codebase already wrote for the identical mistake.
 */
export async function readHydratedCommerce(): Promise<CommerceSettings | null> {
  if (!(await ensureSettingsHydrated())) return null;
  return getCommerceSettings();
}

/**
 * A settings slice, plus whether the SERVER took it.
 *
 * `SettingsServerSync` merges the server's copy over the local one on every
 * admin page load, so a section the server rejected is not saved — it is
 * reverted at the next navigation. That covers real settings: the session
 * timeout, the maintenance switch, tax rates, delivery fees.
 */
export interface SettingsWriteResult<T> {
  value: T;
  persisted: boolean;
}

async function updateStore(
  patch: Partial<AppSettings>,
  activity?: { action: string; entity: string; details?: string }
): Promise<SettingsWriteResult<AppSettings>> {
  // Before reading the local copy, make sure it IS the server's copy. A section
  // PUT is a replace-all, so merging a patch onto an unhydrated cache and
  // sending it is how the demo seed overwrites a real shop's settings.
  //
  // Note what this can and cannot do. The SECTIONS NOT IN `patch` are protected
  // here. The section that IS in `patch` came from the caller — a form holding a
  // snapshot — and merging server values back into it would silently undo the
  // admin's deliberate deletions. Protecting that one is the form's job: see
  // `useSettingsSection`, which keeps the fields behind a skeleton until this
  // same hydration has landed.
  const hydrated = await ensureSettingsHydrated();

  /**
   * The cache exactly as it stands, so a refused write can be undone.
   *
   * Without this a rejected save stayed in localStorage, and every settings
   * form writes its whole section back from that cache — so the next edit to
   * one unrelated field carried the rejected payload to the server. A change
   * the admin was told had failed landed later, by the back door. The
   * appearance, header, footer and SEO stores all carry this guard now.
   */
  const previousRaw =
    typeof window === "undefined" ? null : localStorage.getItem(STORAGE_KEY);

  const current = loadSettings();
  let next = mergeAppSettings({ ...current, ...patch });
  if (activity) {
    next = appendActivity(next, activity.action, activity.entity, activity.details);
  }
  const saved = saveSettings(next);

  // Dual-write to the server for any changed section. This USED to be
  // fire-and-forget, discarding the boolean pushSection already computed, so
  // every settings page toasted success on a 401 or a 422 and the change
  // silently reverted on the next page load.
  const sections = Object.keys(patch).filter((key) =>
    (SERVER_SECTIONS as readonly string[]).includes(key)
  );

  // Hydration failed, so `pushSection` would refuse every one of these anyway —
  // after burning the gate's 8-second timeout each time, with the Save button
  // sitting there enabled and unlabelled. Report the failure now instead.
  if (!hydrated && sections.length > 0) {
    rollBackCache(previousRaw, saved);
    return { value: saved, persisted: false };
  }

  const results = await Promise.all(
    sections.map((key) => pushSection(key, saved[key as keyof AppSettings]))
  );

  // A patch touching no server-backed section (the activity log) has nothing
  // that could fail, so it is trivially persisted.
  const persisted = results.every(Boolean);
  if (!persisted) rollBackCache(previousRaw, saved);

  // The attempted value goes back to the FORM even on refusal: it is the
  // admin's own typing and they must be able to retry it. Only the cache is
  // undone — that is the copy every other form reads its section from.
  return { value: saved, persisted };
}

/**
 * Undoes a refused write in the CACHE, leaving the caller's value alone.
 *
 * Every settings form writes its whole section back from this cache, so a
 * rejected payload left there reaches the server by the back door on the next
 * edit to an unrelated field — a change the admin was told had failed,
 * landing later. The form keeps the attempted value so the admin can retry;
 * the cache must not.
 *
 * Restores only if this write is still the one in the cache: undoing
 * unconditionally would destroy a concurrent save the server had accepted.
 */
function rollBackCache(previousRaw: string | null, attempted: AppSettings): void {
  if (typeof window === "undefined") return;

  // Compared against what was WRITTEN, which is the scrubbed copy — the
  // in-memory object still carries the typed mail password and would never
  // match, quietly turning this guard into "never roll back".
  const stillOurs =
    localStorage.getItem(STORAGE_KEY) === JSON.stringify(scrubbedForCache(attempted));
  if (!stillOurs) return;

  if (previousRaw === null) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, previousRaw);

  /**
   * The undo has to be announced, exactly as the write was.
   *
   * `persist()` dispatches SETTINGS_UPDATED_EVENT and every live consumer reads
   * the store on it — the sidebar, the storefront module gates, the currency
   * and timezone. The rollback wrote to localStorage silently, so a refused
   * save left the whole admin sitting on the value the server had turned down:
   * the Wedding Builder entry gone from the sidebar, Photo Cake absent from the
   * product form, the business type switched — all from a write that never
   * landed, until something else happened to fire the event or the page was
   * reloaded. The toast said "saved on this device only"; it was not even here.
   *
   * The raw string goes back rather than routing through `persist()`, so the
   * restored value is byte-identical to the one the `stillOurs` guard compared.
   */
  window.dispatchEvent(new CustomEvent(SETTINGS_UPDATED_EVENT));
}

export function getGeneralSettings(): GeneralSettings {
  return loadSettings().general;
}

export function getContactSettings(): ContactSettings {
  return loadSettings().contact;
}

export function getSocialLinks(): SocialLinkSettings[] {
  return loadSettings().social;
}

export function getActiveSocialLinks(): SocialLinkSettings[] {
  return getSocialLinks().filter((link) => link.isActive);
}

export function getSecuritySettings(): SecuritySettings {
  return loadSettings().security;
}

export function getSmtpSettings(): SmtpSettings {
  return loadSettings().smtp;
}

export function getAnalyticsSettings(): AnalyticsSettings {
  return loadSettings().analytics;
}

export function getMaintenanceSettings(): MaintenanceSettings {
  return loadSettings().maintenance;
}

export function getCommerceSettings(): CommerceSettings {
  return loadSettings().commerce;
}

export function getModuleSettings(): ModuleSettings {
  return loadSettings().modules;
}

/**
 * The shop's own words for what it sells, as stored.
 *
 * Raw overrides, not resolved labels — the caller layers these over the preset
 * through `resolveLabels`, so a blank field still means "use the preset" at
 * exactly one place.
 */
export function getLabelSettings(): LabelOverrides {
  return loadSettings().labelOverrides ?? {};
}

/**
 * Wedding features (builder, wedding-cakes page/nav, wedding inquiries) are
 * bakery-only and gated by the wedding module. Shared by admin + storefront so
 * every surface hides wedding consistently.
 */
export function isWeddingEnabled(): boolean {
  // The switch is the whole gate. This also required
  // `businessType === "bakery"`, which is gone; `defaultModuleSettings` now
  // carries what that enum used to, so a shop that never asked for the Wedding
  // Builder still does not get one.
  return loadSettings().modules.weddingBuilder;
}

export function getActivityLog(): ActivityLog[] {
  return loadSettings().activity;
}

export async function saveGeneralSettings(
  general: GeneralSettings
): Promise<SettingsWriteResult<GeneralSettings>> {
  const { value, persisted } = await updateStore({ general }, {
    action: "updated",
    entity: "settings",
    details: "General settings saved",
  });
  return { value: value.general, persisted };
}

export async function saveContactSettings(
  contact: ContactSettings
): Promise<SettingsWriteResult<ContactSettings>> {
  const { value, persisted } = await updateStore({ contact }, {
    action: "updated",
    entity: "settings",
    details: "Contact settings saved",
  });
  return { value: value.contact, persisted };
}

export async function saveSocialLinks(
  social: SocialLinkSettings[]
): Promise<SettingsWriteResult<SocialLinkSettings[]>> {
  const { value, persisted } = await updateStore({ social }, {
    action: "updated",
    entity: "settings",
    details: "Social links updated",
  });
  return { value: value.social, persisted };
}

export async function saveSecuritySettings(
  security: SecuritySettings
): Promise<SettingsWriteResult<SecuritySettings>> {
  const { value, persisted } = await updateStore({ security }, {
    action: "updated",
    entity: "settings",
    details: "Security settings saved",
  });
  return { value: value.security, persisted };
}

export async function saveSmtpSettings(
  smtp: SmtpSettings
): Promise<SettingsWriteResult<SmtpSettings>> {
  const { value, persisted } = await updateStore({ smtp }, {
    action: "updated",
    entity: "settings",
    details: "SMTP settings saved",
  });
  return { value: value.smtp, persisted };
}

export async function saveAnalyticsSettings(
  analytics: AnalyticsSettings
): Promise<SettingsWriteResult<AnalyticsSettings>> {
  const { value, persisted } = await updateStore({ analytics }, {
    action: "updated",
    entity: "settings",
    details: "Analytics settings saved",
  });
  return { value: value.analytics, persisted };
}

export async function saveMaintenanceSettings(
  maintenance: MaintenanceSettings
): Promise<SettingsWriteResult<MaintenanceSettings>> {
  const { value, persisted } = await updateStore({ maintenance }, {
    action: maintenance.isEnabled ? "enabled" : "disabled",
    entity: "maintenance",
    details: maintenance.isEnabled
      ? "Maintenance mode enabled"
      : "Maintenance mode disabled",
  });
  return { value: value.maintenance, persisted };
}

export async function saveCommerceSettings(
  commerce: CommerceSettings
): Promise<SettingsWriteResult<CommerceSettings>> {
  const { value, persisted } = await updateStore({ commerce }, {
    action: "updated",
    entity: "settings",
    details: "Commerce settings saved",
  });
  return { value: value.commerce, persisted };
}

export async function saveModuleSettings(
  modules: ModuleSettings
): Promise<SettingsWriteResult<ModuleSettings>> {
  const { value, persisted } = await updateStore({ modules }, {
    action: "updated",
    entity: "settings",
    details: "Module settings saved",
  });
  return { value: value.modules, persisted };
}

export async function saveLabelSettings(
  labelOverrides: LabelOverrides
): Promise<SettingsWriteResult<LabelOverrides>> {
  const { value, persisted } = await updateStore({ labelOverrides }, {
    action: "updated",
    entity: "settings",
    details: "Product wording saved",
  });
  return { value: value.labelOverrides, persisted };
}

export async function clearActivityLog(): Promise<SettingsWriteResult<ActivityLog[]>> {
  const { value, persisted } = await updateStore({ activity: [] }, {
    action: "cleared",
    entity: "activity",
    details: "Activity log cleared",
  });
  return { value: value.activity, persisted };
}

/**
 * A reset, reporting what is ACTUALLY in place when the server refuses one.
 *
 * `runWrite` commits the returned value as the form's working copy whatever the
 * server answered — it has to, because on a refused SAVE that value is the
 * admin's own typing and they must be able to retry it. A reset is not typing.
 * Handing back the defaults after a refusal left the form showing the demo
 * values over settings the shop still had: the toast said "the saved settings
 * are unchanged" while the screen said the opposite, and the admin's next Save
 * pushed those defaults up for real.
 *
 * Four of the nine resets were repaired for this, one at a time, each with its
 * own copy of the explanation — and five were left on the old behaviour,
 * Commerce among them, which carries the tax rate, the delivery fee, the
 * minimum order value and which payment methods are switched on. One helper, so
 * the tenth reset cannot be written the wrong way.
 *
 * `readCurrent` is called only on refusal, so it reads the last value the
 * server confirmed rather than the one it turned down.
 *
 * AND IT DRIVES THE RESET ENDPOINT, not a PUT of the defaults. For eight
 * sections those are the same thing; for SMTP they are not.
 * `defaultSmtpSettings.password` is `""`, and the server reads a blank password
 * as "keep the stored one" — a rule that must exist, because the form is never
 * sent the password back. So a "reset" wrote the demo host, port and username
 * with the shop's OLD password reattached, said "SMTP settings reset to
 * defaults", and flipped the hint to "No password saved" while the mail
 * transport went on authenticating with it. `POST /api/settings/<section>/reset`
 * skips that rule and files a `settings.reset.<section>` audit row instead of an
 * update. See `resetSectionRequest`.
 */
async function resetToDefaults<K extends keyof AppSettings>(
  section: K & string,
  defaults: AppSettings[K],
  readCurrent: () => AppSettings[K],
  details: string,
): Promise<SettingsWriteResult<AppSettings[K]>> {
  // The local cache is rewritten from the defaults below, and doing that to an
  // unhydrated cache leaves the demo seed where the next save will push it.
  if (!(await ensureSettingsHydrated())) return { value: readCurrent(), persisted: false };
  if (!(await resetSectionRequest(section))) return { value: readCurrent(), persisted: false };

  // The server has already done it, so this is a LOCAL write only — pushing
  // the defaults back would be the PUT this exists to avoid.
  const current = loadSettings();
  const next = appendActivity(
    mergeAppSettings({ ...current, [section]: defaults } as Partial<AppSettings>),
    "reset",
    "settings",
    details,
  );
  const saved = saveSettings(next);
  return { value: saved[section], persisted: true };
}

/** Section-scoped resets — do not wipe sibling settings slices. */
export function resetGeneralSettings(): Promise<SettingsWriteResult<GeneralSettings>> {
  return resetToDefaults("general", { ...defaultGeneralSettings }, getGeneralSettings, "General settings reset");
}

export function resetContactSettings(): Promise<SettingsWriteResult<ContactSettings>> {
  return resetToDefaults("contact", { ...defaultContactSettings }, getContactSettings, "Contact settings reset");
}

export function resetSocialLinks(): Promise<SettingsWriteResult<SocialLinkSettings[]>> {
  return resetToDefaults(
    "social",
    defaultSocialLinks.map((link) => ({ ...link })),
    getSocialLinks,
    "Social links reset",
  );
}

export function resetSecuritySettings(): Promise<SettingsWriteResult<SecuritySettings>> {
  return resetToDefaults("security", { ...defaultSecuritySettings }, getSecuritySettings, "Security settings reset");
}

export function resetSmtpSettings(): Promise<SettingsWriteResult<SmtpSettings>> {
  return resetToDefaults("smtp", { ...defaultSmtpSettings }, getSmtpSettings, "SMTP settings reset");
}

export function resetAnalyticsSettings(): Promise<SettingsWriteResult<AnalyticsSettings>> {
  return resetToDefaults("analytics", { ...defaultAnalyticsSettings }, getAnalyticsSettings, "Analytics settings reset");
}

export function resetMaintenanceSettings(): Promise<SettingsWriteResult<MaintenanceSettings>> {
  return resetToDefaults(
    "maintenance",
    { ...defaultMaintenanceSettings },
    getMaintenanceSettings,
    "Maintenance settings reset",
  );
}

export function resetCommerceSettings(): Promise<SettingsWriteResult<CommerceSettings>> {
  return resetToDefaults(
    "commerce",
    {
      ...defaultCommerceSettings,
      paymentMethods: { ...defaultCommerceSettings.paymentMethods },
      deliveryTimeSlots: [...defaultCommerceSettings.deliveryTimeSlots],
    },
    getCommerceSettings,
    "Commerce settings reset",
  );
}

export function resetModuleSettings(): Promise<SettingsWriteResult<ModuleSettings>> {
  return resetToDefaults("modules", { ...defaultModuleSettings }, getModuleSettings, "Module settings reset");
}

export function resetLabelSettings(): Promise<SettingsWriteResult<LabelOverrides>> {
  return resetToDefaults(
    "labelOverrides",
    { ...defaultLabelOverrides },
    getLabelSettings,
    "Product wording reset",
  );
}

export function exportLocalStorageBackup(): Record<string, string | null> {
  if (typeof window === "undefined") return {};

  const backup: Record<string, string | null> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("bakery-cms")) {
      backup[key] = localStorage.getItem(key);
    }
  }
  return backup;
}

/**
 * The list of rollback points is not shop data, and a restore never writes it.
 *
 * `bakery-cms-backup-history` starts with `bakery-cms` like everything else, so
 * it rode along in both directions: every snapshot embedded the whole previous
 * history (doubling in size per export until localStorage threw and export
 * simply stopped working), and every restore replaced this machine's history
 * with the one from the file — including the "Before import" snapshot the
 * import dialog had written seconds earlier and promised the admin they could
 * roll back to. The one rollback point they need is the one the restore
 * deleted.
 *
 * Named here rather than only at the call sites because this function is the
 * choke point every restore path goes through, including the legacy one.
 */
const BACKUP_HISTORY_KEY = "bakery-cms-backup-history";

export function importLocalStorageBackup(
  backup: Record<string, string | null>
): number {
  if (typeof window === "undefined") return 0;

  let count = 0;
  for (const [key, value] of Object.entries(backup)) {
    if (!key.startsWith("bakery-cms") || value === null) continue;
    if (key === BACKUP_HISTORY_KEY) continue;
    localStorage.setItem(key, value);
    count += 1;
  }
  return count;
}
