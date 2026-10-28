import type { DistrictEntry, PincodeInfo, PincodePlace } from "@/types/delivery";
import { noteAuthStatus } from "@/features/auth/lib/session-expiry";

/**
 * The browser's way into India Post's PIN directory, which stays on the
 * server (features/commerce/server/pincode-directory.ts). One small request
 * for the codes in hand, remembered for the visit — the answers do not change
 * while a page is open.
 *
 * Every function resolves null when the directory could not be asked (offline,
 * a server error). Callers treat that as "not known", never as "not real": a
 * customer must not be told their PIN does not exist because a request failed.
 */

const known = new Map<string, PincodeInfo>();

interface Envelope<T> {
  success: boolean;
  data: T | null;
}

async function get<T>(query: string): Promise<T | null> {
  try {
    const res = await fetch(`/api/pincodes?${query}`, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      // A public read, but the same rule as every other: a 401 is announced.
      noteAuthStatus(res.status);
      return null;
    }
    const json = (await res.json()) as Envelope<T>;
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

/** What each code means — a place for six digits, a summary for a prefix. */
export async function fetchPincodeInfo(codes: string[]): Promise<Record<string, PincodeInfo> | null> {
  const wanted = [...new Set(codes)].filter((code) => /^[1-9]\d{2,5}$/.test(code));
  const missing = wanted.filter((code) => !known.has(code));
  for (let i = 0; i < missing.length; i += 100) {
    const batch = await get<Record<string, PincodeInfo>>(`codes=${missing.slice(i, i + 100).join(",")}`);
    if (!batch) return null;
    for (const [code, info] of Object.entries(batch)) known.set(code, info);
  }
  return Object.fromEntries(wanted.flatMap((code) => (known.has(code) ? [[code, known.get(code)!]] : [])));
}

/**
 * The place at a six-digit PIN: `{ place }` with null when India Post lists
 * no such PIN, or null when it could not be asked.
 */
export async function fetchPincodePlace(pincode: string): Promise<{ place: PincodePlace | null } | null> {
  const info = (await fetchPincodeInfo([pincode]))?.[pincode];
  return info?.kind === "pin" ? { place: info.place } : null;
}

const suggested = new Map<string, PincodePlace[]>();

/**
 * The real PINs a half-typed code could be — "3240" → 324001 Kota … — for the
 * list under a PIN box. Null when the directory could not be asked.
 */
export async function fetchPincodeSuggestions(prefix: string): Promise<PincodePlace[] | null> {
  if (!/^[1-9]\d{2,5}$/.test(prefix)) return [];
  const hit = suggested.get(prefix);
  if (hit) return hit;
  const list = await get<PincodePlace[]>(`prefix=${prefix}`);
  if (list) suggested.set(prefix, list);
  return list;
}

let districts: Promise<DistrictEntry[] | null> | null = null;

/** Every district, for the zone form's suggestions. Asked once per visit. */
export function fetchDistricts(): Promise<DistrictEntry[] | null> {
  districts ??= get<DistrictEntry[]>("districts=1").then((list) => {
    if (!list) districts = null;
    return list;
  });
  return districts;
}
