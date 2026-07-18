import { specialOffers } from "@/constants/landing-data";

const COUPONS_STORAGE_KEY = "bakery-cms-coupons";

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

function buildDefaultCoupons(): StoredCoupon[] {
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
  writeCoupons(seeded);
  return seeded;
}

function readCoupons(): StoredCoupon[] {
  if (typeof window === "undefined") return getServerCouponDefaults();

  try {
    const raw = localStorage.getItem(COUPONS_STORAGE_KEY);
    if (!raw) return seedCoupons();
    const parsed = JSON.parse(raw) as StoredCoupon[];
    if (!Array.isArray(parsed) || parsed.length === 0) return seedCoupons();
    return parsed;
  } catch {
    return seedCoupons();
  }
}

function writeCoupons(coupons: StoredCoupon[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(COUPONS_STORAGE_KEY, JSON.stringify(coupons));
  window.dispatchEvent(new Event("bakery-coupons-updated"));
}

export function loadCoupons(): StoredCoupon[] {
  return readCoupons();
}

export function getActiveCoupons(): StoredCoupon[] {
  const now = Date.now();
  return readCoupons().filter((coupon) => {
    if (!coupon.isActive) return false;
    if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < now) return false;
    return true;
  });
}

export function getCouponByCode(code: string): StoredCoupon | null {
  const normalized = code.trim().toUpperCase();
  return readCoupons().find((coupon) => coupon.code === normalized) ?? null;
}

export function createCoupon(
  input: Omit<StoredCoupon, "id" | "usageCount" | "createdAt">
): StoredCoupon {
  const coupon: StoredCoupon = {
    ...input,
    id: crypto.randomUUID(),
    code: input.code.trim().toUpperCase(),
    usageCount: 0,
    createdAt: new Date().toISOString(),
  };

  const coupons = readCoupons();
  if (coupons.some((item) => item.code === coupon.code)) {
    throw new Error("Coupon code already exists");
  }

  writeCoupons([coupon, ...coupons]);
  return coupon;
}

export function updateCoupon(
  id: string,
  patch: Partial<Omit<StoredCoupon, "id" | "createdAt">>
): StoredCoupon | null {
  const coupons = readCoupons();
  const index = coupons.findIndex((coupon) => coupon.id === id);
  if (index === -1) return null;

  const nextCode = patch.code?.trim().toUpperCase();
  if (nextCode && coupons.some((item, i) => i !== index && item.code === nextCode)) {
    throw new Error("Coupon code already exists");
  }

  const updated: StoredCoupon = {
    ...coupons[index],
    ...patch,
    code: nextCode ?? coupons[index].code,
  };

  coupons[index] = updated;
  writeCoupons(coupons);
  return updated;
}

export function deleteCoupons(ids: string[]): number {
  const current = readCoupons();
  const coupons = current.filter((coupon) => !ids.includes(coupon.id));
  const removed = current.length - coupons.length;
  writeCoupons(coupons);
  return removed;
}

export function toggleCouponActive(id: string): StoredCoupon | null {
  const coupons = readCoupons();
  const index = coupons.findIndex((coupon) => coupon.id === id);
  if (index === -1) return null;

  coupons[index] = { ...coupons[index], isActive: !coupons[index].isActive };
  writeCoupons(coupons);
  return coupons[index];
}

export function incrementCouponUsage(code: string): void {
  const coupons = readCoupons();
  const index = coupons.findIndex((coupon) => coupon.code === code.trim().toUpperCase());
  if (index === -1) return;

  coupons[index] = {
    ...coupons[index],
    usageCount: coupons[index].usageCount + 1,
  };
  writeCoupons(coupons);
}

export function resetCoupons(): StoredCoupon[] {
  const defaults = buildDefaultCoupons();
  writeCoupons(defaults);
  return defaults;
}
