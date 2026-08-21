import type { EmailTemplateFormData, EmailTemplateRecord } from "@/types/communication";
import { mergeTemplateVariables } from "@/lib/template-render";
import {
  emailTemplatesHydration,
  replaceEmailTemplatesRequest,
} from "./communications-api";
import type { WriteResult } from "@/lib/write-result";
import { seedEmailTemplates } from "@/features/communications/lib/email-template-seed";

const STORAGE_KEY = "bakery-cms-email-templates";
const STORAGE_VERSION_KEY = "bakery-cms-email-templates-version";
const STORAGE_VERSION = 1;

export const EMAIL_TEMPLATES_UPDATED_EVENT = "bakery-email-templates-updated";

function nowIso(): string {
  return new Date().toISOString();
}

function emitUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EMAIL_TEMPLATES_UPDATED_EVENT));
}

/**
 * `null` means NEVER SET UP. `[]` means the shop has no templates.
 *
 * This returned `[]` for both, and `loadEmailTemplates` re-seeded whenever the
 * result was empty — so deleting the last template brought the demo set
 * straight back, and the next save PUT it to the server. Worse, the re-seed
 * happens inside a READ, so it fired from the update listener during a
 * rejected save and defeated the rollback's "is this still our write" check.
 *
 * `delivery-zones-repository.ts` draws the same distinction, for the same
 * reason: "no zones" is a legitimate configuration.
 */
function readTemplates(): EmailTemplateRecord[] | null {
  if (typeof window === "undefined") return seedEmailTemplates();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EmailTemplateRecord[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeTemplates(templates: EmailTemplateRecord[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  emitUpdated();
}

/**
 * Local write first, then the server — and the local write is UNDONE when the
 * server refuses.
 *
 * Without the rollback a refused save still changed localStorage, so the page
 * reloaded its list from that cache, found it matched the editor, and showed
 * "All changes saved" with the Save button greyed out — for a change the
 * server had rejected. The admin's only warning was a toast they had already
 * dismissed, and the next hydration silently replaced their work.
 *
 * Keeping the cache to things the server has actually accepted costs one save
 * on a refusal instead of quietly losing it. `delivery-zones-repository.ts`
 * does the same, including the concurrency guard below.
 */
/**
 * The ids in a raw cache snapshot.
 *
 * Read from the snapshot taken BEFORE the write, not from the outgoing list:
 * a delete would otherwise report only the survivors as "known" and the
 * server would never remove the one that was dropped.
 */
function readIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { id?: string }[];
    return Array.isArray(parsed)
      ? parsed.map((item) => item?.id).filter((id): id is string => Boolean(id))
      : [];
  } catch {
    return [];
  }
}

async function persistAndSync(templates: EmailTemplateRecord[]): Promise<boolean> {
  const previous = typeof window === "undefined" ? null : localStorage.getItem(STORAGE_KEY);

  const knownIds = readIds(previous);

  writeTemplates(templates);
  const accepted = await replaceEmailTemplatesRequest(templates, knownIds);

  // Roll back ONLY if this write is still the one in the cache. Restoring the
  // entry snapshot unconditionally would undo a concurrent save the server had
  // accepted in the meantime — a rejected write destroying a good one.
  if (!accepted && typeof window !== "undefined") {
    const stillOurs = localStorage.getItem(STORAGE_KEY) === JSON.stringify(templates);
    if (stillOurs) {
      if (previous === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, previous);
      emitUpdated();
    }
  }

  return accepted;
}

/** Hydration: write the server's templates into the local cache (no re-push). */
export function persistServerEmailTemplates(templates: EmailTemplateRecord[]): void {
  if (typeof window === "undefined") return;
  writeTemplates(templates);
  localStorage.setItem(STORAGE_VERSION_KEY, String(STORAGE_VERSION));
}

function normalizeTemplate(template: EmailTemplateRecord): EmailTemplateRecord {
  const variables = mergeTemplateVariables(template.variables ?? [], [
    template.subject,
    template.previewText ?? "",
    template.body,
  ]);

  return {
    ...template,
    variables,
  };
}

export function loadEmailTemplates(): EmailTemplateRecord[] {
  if (typeof window === "undefined") return seedEmailTemplates();

  const version = Number(localStorage.getItem(STORAGE_VERSION_KEY) ?? 0);
  const existing = readTemplates();

  // Only an ABSENT store gets the demo seed. An empty one is the shop
  // saying it has no templates, and re-seeding over that is how the demo
  // set kept coming back after a delete.
  if (existing === null || version < STORAGE_VERSION) {
    const seeded = existing === null ? seedEmailTemplates() : existing.map(normalizeTemplate);
    writeTemplates(seeded);
    localStorage.setItem(STORAGE_VERSION_KEY, String(STORAGE_VERSION));
    return seeded;
  }

  return existing.map(normalizeTemplate);
}

export function getEmailTemplateById(id: string): EmailTemplateRecord | null {
  return loadEmailTemplates().find((template) => template.id === id) ?? null;
}

export function getEmailTemplateBySlug(slug: string): EmailTemplateRecord | null {
  return loadEmailTemplates().find((template) => template.slug === slug) ?? null;
}

/**
 * Read the list AFTER hydration, then write it.
 *
 * The gate guarded the PUT but not the READ that composed it. Every mutation
 * called `loadEmailTemplates()` first, so an admin who clicked before the server's
 * copy arrived built their payload from the DEMO SEED — `loadEmailTemplates` seeds
 * it when the cache is empty. `guardedPut` then waited politely for the gate,
 * the gate opened, and it shipped that seed as a whole-collection replace.
 * The seed-clobber the gate exists to prevent, surviving inside it.
 *
 * `delivery-zones-repository.ts` documents and fixes this exact ordering; the
 * EmailTemplates store was written before that and never caught up.
 *
 * The mutator now runs on a list the server has already confirmed.
 */
async function mutateEmailTemplates<T>(
  /** Returned when hydration never lands, so callers never see `undefined`. */
  fallback: T,
  mutate: (current: EmailTemplateRecord[]) => { next: EmailTemplateRecord[]; value: T } | { value: T; next?: undefined },
): Promise<WriteResult<T>> {
  if (!(await emailTemplatesHydration.waitForSettled())) {
    return { value: fallback, persisted: false };
  }

  const outcome = mutate(loadEmailTemplates());
  // Nothing to write is only success when nothing was asked for — the callers
  // that return no `next` do so because their target no longer exists.
  if (outcome.next === undefined) return { value: outcome.value, persisted: false };

  return { value: outcome.value, persisted: await persistAndSync(outcome.next) };
}

export async function saveEmailTemplate(
  id: string,
  data: EmailTemplateFormData
): Promise<WriteResult<EmailTemplateRecord | null>> {
  return mutateEmailTemplates<EmailTemplateRecord | null>(null, (current) => {
    const templates = [...current];
    const index = templates.findIndex((template) => template.id === id);
    // Not in the SERVER's list: another admin deleted it while this one was
    // editing. Reporting success would grey out Save on a template that no
    // longer exists.
    if (index === -1) return { value: null };

    const updated: EmailTemplateRecord = normalizeTemplate({
      ...templates[index],
      ...data,
      id,
      updatedAt: nowIso(),
    });
    templates[index] = updated;
    return { next: templates, value: updated };
  });
}

export async function createEmailTemplate(
  data: EmailTemplateFormData
): Promise<WriteResult<EmailTemplateRecord>> {
  const timestamp = nowIso();
  const template = normalizeTemplate({
    ...data,
    id: `email-${Date.now()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return mutateEmailTemplates(template, (current) => ({
    next: [template, ...current],
    value: template,
  }));
}

/** `value` is false when no such template existed, so nothing was sent. */
export async function deleteEmailTemplate(id: string): Promise<WriteResult<boolean>> {
  return mutateEmailTemplates(false, (current) => {
    const next = current.filter((template) => template.id !== id);
    if (next.length === current.length) return { value: false };
    return { next, value: true };
  });
}

/**
 * Reset, through the same gate as every other mutation.
 *
 * This called `persistAndSync` directly — the one write on this screen
 * that skipped `mutateEmailTemplates`, whose whole documented purpose is to
 * await hydration BEFORE composing a payload. So the `knownIds` snapshot
 * was taken from a cache the server had never filled: empty, meaning the
 * server deleted nothing, kept every custom template the browser had not
 * seen, and the admin was told "reset to defaults" over a list that had
 * not been reset.
 *
 * Nothing about resetting justifies the exception. It is a whole-collection
 * replace like the others, and it is the most destructive one.
 */
export async function resetEmailTemplates(): Promise<WriteResult<EmailTemplateRecord[]>> {
  const seeded = seedEmailTemplates();
  const result = await mutateEmailTemplates(seeded, () => ({ next: seeded, value: seeded }));
  if (result.persisted) {
    localStorage.setItem(STORAGE_VERSION_KEY, String(STORAGE_VERSION));
  }
  return result;
}
