import { specialOffers } from "@/constants/landing-data";
import { couponsHydration, replaceCouponsRequest } from "./commerce-api";
import { hasExpired } from "@/lib/expiry-date";
import type { WriteResult } from "@/lib/write-result";

const COUPONS_STORAGE_KEY = "bakery-cms-coupons";

/**
 * Named once, because a listener that mistypes it simply never fires — which
 * is a silent bug, not a loud one.
 */
export const COUPONS_UPDATED_EVENT = "bakery-coupons-updated";

export interface StoredCoupon {
  id: string;
  code: string;
  label: string;
  description: string;
  minSubtotal?: number;
  percentOff?: number;
  flatOff?: number;
  isActive: boolean;
  usageCount: number;
  createdAt: string;
  expiresAt?: string;
}

export function buildDefaultCoupons(): StoredCoupon[] {
  const now = new Date().toISOString();
  const fromOffers = specialOffers
    .filter((offer) => offer.code)
    .map((offer, index) => {
      if (offer.code === "BDAY20") {
        return {
          id: "coupon-bday20",
          code: offer.code,
          label: offer.discount,
          description: offer.description,
          percentOff: 20,
          isActive: true,
          usageCount: 12,
          createdAt: now,
        } satisfies StoredCoupon;
      }
      if (offer.code === "WED2026") {
        return {
          id: "coupon-wed2026",
          code: offer.code,
          label: offer.discount,
          description: offer.description,
          minSubtotal: 10000,
          flatOff: 2000,
          isActive: true,
          usageCount: 4,
          createdAt: now,
        } satisfies StoredCoupon;
      }
      return {
        id: `coupon-offer-${index + 1}`,
        code: offer.code!,
        label: offer.discount,
        description: offer.description,
        percentOff: 10,
        isActive: true,
        usageCount: 0,
        createdAt: now,
      } satisfies StoredCoupon;
    });

  return [
    ...fromOffers,
    {
      id: "coupon-welcome10",
      code: "WELCOME10",
      label: "10% OFF",
      description: "Welcome offer for new customers",
      percentOff: 10,
      isActive: true,
      usageCount: 28,
      createdAt: now,
    },
  ];
}

let serverCouponDefaults: StoredCoupon[] | null = null;

function getServerCouponDefaults(): StoredCoupon[] {
  if (!serverCouponDefaults) {
    serverCouponDefaults = buildDefaultCoupons();
  }
  return serverCouponDefaults;
}

function seedCoupons(): StoredCoupon[] {
  const seeded = buildDefaultCoupons();
  // Low-write: the seed must NOT dual-write to the server (it would clobber the
  // admin's coupons before hydration replaces this local seed).
  lowWriteCoupons(seeded);
  return seeded;
}

function readCoupons(): StoredCoupon[] {
  if (typeof window === "undefined") return getServerCouponDefaults();

  try {
    const raw = localStorage.getItem(COUPONS_STORAGE_KEY);
    if (!raw) return seedCoupons();
    const parsed = JSON.parse(raw) as StoredCoupon[];
    // An empty list is an ANSWER, not a missing one.
    //
    // The SERVER gets this right — `seeded:coupons` separates "never set up"
    // from "set up, and the answer is none" — and the browser did not. An admin
    // who deleted every coupon saw BDAY20, WED2026 and WELCOME10 reappear in the
    // list on the next read, and because every mutation here sends the whole
    // array, their next edit pushed those three back to the server and made them
    // redeemable again. A resurrected WELCOME10 takes 10% off a live order.
    if (!Array.isArray(parsed)) return seedCoupons();
    return parsed;
  } catch {
    return seedCoupons();
  }
}

/**
 * The coupon list, but only once the server's copy has landed in it.
 *
 * Every mutator used to call `readCoupons()` synchronously and await the
 * hydration gate afterwards, inside the PUT. On a first admin visit localStorage
 * is empty, so that read returned the three demo coupons — and the payload was
 * already built from them by the time the gate was consulted. One click on an
 * Active switch before hydration finished therefore replaced the shop's real
 * coupons with the shipped seed. The gate has to guard the READ, not the write.
 *
 * `null` means hydration never settled, and then nothing is sent at all.
 */
async function readHydratedCoupons(): Promise<StoredCoupon[] | null> {
  if (!(await couponsHydration.waitForSettled())) return null;
  return readCoupons();
}

/** Local-only write (localStorage + event). No server dual-write. */
function lowWriteCoupons(coupons: StoredCoupon[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(COUPONS_STORAGE_KEY, JSON.stringify(coupons));
  window.dispatchEvent(new Event(COUPONS_UPDATED_EVENT));
}

/** Mutation write: local first, then the server, reporting what the server did. */
async function writeCoupons(
  coupons: StoredCoupon[],
  /**
   * The ids this browser held BEFORE the edit.
   *
   * The server deletes only what the caller had and has now dropped. Without
   * it a save asserts "these are all the coupons there are", so a tab opened
   * before another admin created a code silently deleted that code — a
   * discount customers may already have been given, gone, with both saves
   * reporting success.
   */
  knownIds: string[],
): Promise<boolean> {
  const previous =
    typeof window === "undefined" ? null : localStorage.getItem(COUPONS_STORAGE_KEY);

  lowWriteCoupons(coupons);
  const accepted = await replaceCouponsRequest(coupons, knownIds);

  /**
   * Roll back a write the server refused.
   *
   * The local write used to stand whatever the server answered. So an edit
   * dropping WELCOME10 from 10% to 5% that came back 401 left 5% in the cache
   * and on the admin's screen — and because every save sends the whole list, the
   * NEXT save from that tab, about an entirely different coupon, pushed the
   * never-approved 5% to the server. The shop's live discount changed from a
   * click that had nothing to do with it.
   *
   * Only if this write is still the one in the cache: restoring the snapshot
   * unconditionally would undo a concurrent save the server HAD accepted, which
   * is worse than the poisoned cache this exists to prevent. The delivery zones
   * beside it do exactly this, and coupons were left on the old behaviour.
   */
  if (!accepted && typeof window !== "undefined") {
    const stillOurs =
      localStorage.getItem(COUPONS_STORAGE_KEY) === JSON.stringify(coupons);
    if (stillOurs) {
      if (previous === null) localStorage.removeItem(COUPONS_STORAGE_KEY);
      else localStorage.setItem(COUPONS_STORAGE_KEY, previous);
      window.dispatchEvent(new Event(COUPONS_UPDATED_EVENT));
    }
  }

  return accepted;
}

/** Hydration: write the server's coupons into the local cache (no re-push). */
export function persistServerCoupons(coupons: StoredCoupon[]): void {
  lowWriteCoupons(coupons);
}

export function loadCoupons(): StoredCoupon[] {
  return readCoupons();
}

export function getActiveCoupons(): StoredCoupon[] {
  const now = Date.now();
  return readCoupons().filter((coupon) => {
    if (!coupon.isActive) return false;
    if (hasExpired(coupon.expiresAt, now)) return false;
    return true;
  });
}

export function getCouponByCode(code: string): StoredCoupon | null {
  const normalized = code.trim().toUpperCase();
  return readCoupons().find((coupon) => coupon.code === normalized) ?? null;
}

export async function createCoupon(
  input: Omit<StoredCoupon, "id" | "usageCount" | "createdAt">
): Promise<WriteResult<StoredCoupon>> {
  const coupon: StoredCoupon = {
    ...input,
    id: crypto.randomUUID(),
    code: input.code.trim().toUpperCase(),
    usageCount: 0,
    createdAt: new Date().toISOString(),
  };

  const coupons = await readHydratedCoupons();
  if (coupons === null) return { value: coupon, persisted: false };
  if (coupons.some((item) => item.code === coupon.code)) {
    throw new Error("Coupon code already exists");
  }

  return {
    value: coupon,
    persisted: await writeCoupons([coupon, ...coupons], coupons.map((item) => item.id)),
  };
}

export async function updateCoupon(
  id: string,
  patch: Partial<Omit<StoredCoupon, "id" | "createdAt">>
): Promise<WriteResult<StoredCoupon | null>> {
  const coupons = await readHydratedCoupons();
  if (coupons === null) return { value: null, persisted: false };
  const index = coupons.findIndex((coupon) => coupon.id === id);
  if (index === -1) return { value: null, persisted: false };

  const nextCode = patch.code?.trim().toUpperCase();
  if (nextCode && coupons.some((item, i) => i !== index && item.code === nextCode)) {
    throw new Error("Coupon code already exists");
  }

  const updated: StoredCoupon = {
    ...coupons[index],
    ...patch,
    code: nextCode ?? coupons[index].code,
  };

  const knownIds = coupons.map((item) => item.id);
  coupons[index] = updated;
  return { value: updated, persisted: await writeCoupons(coupons, knownIds) };
}

export async function deleteCoupons(ids: string[]): Promise<WriteResult<number>> {
  const current = await readHydratedCoupons();
  if (current === null) return { value: 0, persisted: false };
  const coupons = current.filter((coupon) => !ids.includes(coupon.id));
  const removed = current.length - coupons.length;
  return {
    value: removed,
    persisted: await writeCoupons(coupons, current.map((coupon) => coupon.id)),
  };
}

export async function toggleCouponActive(
  id: string
): Promise<WriteResult<StoredCoupon | null>> {
  const coupons = await readHydratedCoupons();
  if (coupons === null) return { value: null, persisted: false };
  const index = coupons.findIndex((coupon) => coupon.id === id);
  if (index === -1) return { value: null, persisted: false };

  const knownIds = coupons.map((item) => item.id);
  coupons[index] = { ...coupons[index], isActive: !coupons[index].isActive };
  return { value: coupons[index], persisted: await writeCoupons(coupons, knownIds) };
}

// A storefront-side `incrementCouponUsage` lived here and is gone.
//
// It bumped one counter in the local cache and then PUT THE WHOLE LIST to
// `/api/coupons` — a replace-all — from a customer's checkout. A visitor whose
// cache was stale or partial replaced the shop's coupons with it, deleting every
// code added since that cache was filled. The counter is not worth a
// whole-collection write from a browser under any circumstances.
//
// `placeOrder` already counts the redemption server-side with an atomic `$inc`,
// against the code the shop itself resolved rather than the one the client
// claimed — see `incrementCouponUsage` in features/commerce/server.

/**
 * Back to the shipped codes.
 *
 * A reset genuinely means "make the server look like this", so unlike an
 * ordinary save it DOES claim the codes it is dropping — otherwise every
 * coupon the shop had created would survive a reset the admin was told had
 * happened.
 */
export async function resetCoupons(): Promise<WriteResult<StoredCoupon[]>> {
  const defaults = buildDefaultCoupons();
  const current = await readHydratedCoupons();
  if (current === null) return { value: defaults, persisted: false };
  const knownIds = current.map((coupon) => coupon.id);
  return { value: defaults, persisted: await writeCoupons(defaults, knownIds) };
}
