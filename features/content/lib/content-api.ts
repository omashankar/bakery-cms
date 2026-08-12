/**
 * Client-side content API (banners, testimonials, FAQ). Whole-collection
 * replace-all dual-write + hydrate. Never throws; every write reports whether the server took it. The SEED is
 * never dual-written; only admin mutations are.
 */
import { createHydrationGate } from "@/lib/hydration-gate";
import type { Banner } from "@/types/media";
import type { Testimonial, FaqItem } from "@/types/content";

interface Envelope<T> {
  success: boolean;
  data: T | null;
}

/**
 * The version each collection was last read at, so a save can say which state
 * it was composed against.
 *
 * Without it these replace-all writes had nothing to compare: a second admin
 * tab sent its older list and silently reverted everything done in between,
 * while both tabs reported success.
 */
const versions = new Map<string, number>();

/** A read, and whether it was the complete collection or a visitor's subset. */
export interface ContentRead<T> {
  items: T;
  /**
   * True only when the server answered `X-Content-Scope: full`.
   *
   * A missing header reads as NOT full. That is the safe direction: an older
   * server, a proxy that strips headers or a fetch stand-in without them all
   * mean "cannot prove this is complete", and the only thing this flag gates is
   * whether a replace-all write may be composed from the result.
   */
  full: boolean;
}

async function getJson<T>(path: string): Promise<ContentRead<T> | null> {
  try {
    const res = await fetch(path, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    // Optional-chained: a fetch stand-in need not carry headers, and losing
    // the version must never turn a good read into a failed one.
    const version = res.headers?.get?.("X-Content-Version");
    if (version) versions.set(path, Number(version));
    const json = (await res.json()) as Envelope<T>;
    if (!json.success || json.data === null) return null;
    return { items: json.data, full: res.headers?.get?.("X-Content-Scope") === "full" };
  } catch {
    return null;
  }
}

/**
 * Whether the SERVER accepted the write. Resolves false on a network failure OR
 * a non-2xx response; never throws.
 *
 * This used to be fire-and-forget — it launched the request into a floating
 * async IIFE and returned void, so a 401 from an expired admin token and a 500
 * were both indistinguishable from success. Every caller then reported "saved"
 * for a change that lives only in this browser and that the next hydration
 * silently reverts.
 */
async function putJson(path: string, body: unknown): Promise<boolean> {
  try {
    const known = versions.get(path);
    const res = await fetch(path, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(known === undefined ? {} : { "X-Content-Version": String(known) }),
      },
      body: JSON.stringify(body),
    });

    const version = res.headers?.get?.("X-Content-Version");
    if (version) versions.set(path, Number(version));

    if (res.status === 409) {
      // Someone else moved it on. Re-read so this tab stops being stale — the
      // caller reports the refusal, and the admin's next attempt is against
      // what is actually stored rather than conflicting forever.
      void getJson(path);
      return false;
    }

    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Two gates per collection, because there are two different questions and one
 * `contentHydration` was answering both with the same yes.
 *
 * LOADED — the server answered and its list is in the cache. Enough to RENDER
 * from: the storefront banner strip waits on this so it never advertises the
 * shipped demo campaign, and a visitor's subset is exactly what it should show.
 *
 * WRITABLE — that answer was the COMPLETE collection. Only then may a
 * replace-all be composed from the cache. A visitor's read cannot settle this,
 * because the rows it filtered out are precisely the ones such a write would
 * delete: every switched-off, scheduled and expired banner, every unpublished
 * FAQ, every unapproved testimonial.
 *
 * Conflating them is what destroyed content. `ContentServerSync` runs from
 * `app-providers`, which wraps /login, so an admin signing in through the form
 * hydrated while anonymous and marked the cache trustworthy; signing in is a
 * soft navigation, so that `[]`-dep effect never ran again. The first banner
 * they edited PUT a list with the hidden ones missing.
 *
 * Per collection, too. These were one gate for all three, so a banners read
 * that 500'd made every FAQ and testimonial save for the rest of the session
 * report "saved on this device only" — `guardedPut` waits, times out and
 * returns false without ever issuing the PUT — for collections the server was
 * answering perfectly well. `commerce-api.ts` already keeps coupons and zones
 * apart for this reason.
 */
export const bannersLoaded = createHydrationGate();
export const testimonialsLoaded = createHydrationGate();
export const faqsLoaded = createHydrationGate();

export const bannersWritable = createHydrationGate();
export const testimonialsWritable = createHydrationGate();
export const faqsWritable = createHydrationGate();

/**
 * A replace-all write sends the ENTIRE local list. Waiting for hydration is what
 * stops a browser that never loaded the server's copy from overwriting it — see
 * `createHydrationGate`.
 */
async function guardedPut(
  gate: { waitForSettled: () => Promise<boolean> },
  path: string,
  body: unknown,
): Promise<boolean> {
  if (!(await gate.waitForSettled())) return false;
  return putJson(path, body);
}

export const BANNERS_PATH = "/api/content/banners";
export const TESTIMONIALS_PATH = "/api/content/testimonials";
export const FAQS_PATH = "/api/content/faq";

export const fetchBanners = () => getJson<Banner[]>(BANNERS_PATH);
export const replaceBannersRequest = (items: Banner[]) =>
  guardedPut(bannersWritable, BANNERS_PATH, items);

export const fetchTestimonials = () => getJson<Testimonial[]>(TESTIMONIALS_PATH);
export const replaceTestimonialsRequest = (items: Testimonial[]) =>
  guardedPut(testimonialsWritable, TESTIMONIALS_PATH, items);

export const fetchFaqs = () => getJson<FaqItem[]>(FAQS_PATH);
export const replaceFaqsRequest = (items: FaqItem[]) =>
  guardedPut(faqsWritable, FAQS_PATH, items);

/**
 * Settle both gates from one read, honestly.
 *
 * Shared so the three collections cannot drift apart, and so there is exactly
 * one place that decides what a read entitles the cache to do.
 */
export function settleFromRead<T>(
  read: ContentRead<T> | null,
  gates: { loaded: { markSettled: () => void }; writable: { markSettled: () => void } },
): T | null {
  if (!read) return null;
  gates.loaded.markSettled();
  if (read.full) gates.writable.markSettled();
  return read.items;
}
