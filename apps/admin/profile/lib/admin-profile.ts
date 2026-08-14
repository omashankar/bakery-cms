"use client";

import { getDemoSession } from "@/features/auth/lib/session";
import {
  replaceAdminProfileRequest,
} from "@/features/admin-config/lib/admin-config-api";

/**
 * Admin profile store (single-admin CMS). Email comes from the session (read-only);
 * the editable fields live here in localStorage. Frontend only — no backend.
 */

const STORAGE_KEY = "bakery-cms-admin-profile";
export const ADMIN_PROFILE_UPDATED_EVENT = "bakery-admin-profile-updated";

export interface AdminProfile {
  fullName: string;
  email: string;
  mobile: string;
  username: string;
  photoUrl: string;
  role: string;
  status: "Active" | "Suspended";
  lastLogin: string;
  createdAt: string;
}

type StoredProfile = Partial<Omit<AdminProfile, "email" | "role" | "status">>;

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "Bakery Owner";
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ") || "Bakery Owner";
}

function read(): StoredProfile {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") as StoredProfile;
  } catch {
    return {};
  }
}

/** Returns false when the browser refuses the write — a base64 photo can exceed the quota. */
function write(data: StoredProfile): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(ADMIN_PROFILE_UPDATED_EVENT));
  return true;
}

/**
 * The fields the SERVER owns, kept out of the editable blob entirely.
 *
 * These were invented in the browser. The email fell back to a hardcoded
 * personal address — a real one, shipped in the source — so an admin whose
 * local session marker was missing saw a stranger's email presented as their
 * own account address. And `createdAt` / `lastLogin` were SEEDED on first read
 * ("15 January last year", and now) into the same blob `saveAdminProfile`
 * pushes, so the next profile save sent those invented dates to the server as
 * fact.
 *
 * They live under their own key now, are written only by
 * `persistServerAccount` from `/api/auth/me`, and are never part of a push.
 * Blank until the server answers — which the screen renders as an em dash, an
 * honest "not known yet" rather than a plausible date.
 */
const ACCOUNT_KEY = "bakery-cms-admin-account";

interface ServerAccount {
  email?: string;
  name?: string;
  lastLogin?: string;
  createdAt?: string;
  role?: string;
  status?: string;
}

function readAccount(): ServerAccount {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(ACCOUNT_KEY) || "{}") as ServerAccount;
  } catch {
    return {};
  }
}

/** Hydration: the authenticated user as the SERVER knows them. Never pushed back. */
export function persistServerAccount(user: Record<string, unknown> | null): void {
  if (typeof window === "undefined" || !user) return;

  const asString = (value: unknown) => (typeof value === "string" ? value : undefined);
  const account: ServerAccount = {
    email: asString(user.email),
    name: asString(user.name),
    lastLogin: asString(user.lastLoginAt),
    createdAt: asString(user.createdAt),
    role: asString(user.role),
    status: asString(user.status),
  };

  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
  window.dispatchEvent(new Event(ADMIN_PROFILE_UPDATED_EVENT));
}

/** The server's account fields, over the admin's own edits. Nothing invented. */
export function getAdminProfile(): AdminProfile {
  const account = readAccount();
  const merged = read();
  const email = account.email ?? getDemoSession()?.email ?? "";

  return {
    fullName: merged.fullName ?? account.name ?? (email ? nameFromEmail(email) : ""),
    email,
    mobile: merged.mobile ?? "",
    username: merged.username ?? "",
    photoUrl: merged.photoUrl ?? "",
    role: account.role === "owner" ? "Owner" : "Administrator",
    status: account.status === "suspended" ? "Suspended" : "Active",
    lastLogin: account.lastLogin ?? "",
    createdAt: account.createdAt ?? "",
  };
}

/**
 * False when the profile did not reach the SERVER — either the local write was
 * refused (photo too large for the quota) or the server rejected it.
 */
export async function saveAdminProfile(
  patch: Pick<AdminProfile, "fullName" | "mobile" | "username" | "photoUrl">
): Promise<boolean> {
  const saved = read();
  const next: StoredProfile = {
    ...saved,
    fullName: patch.fullName.trim(),
    mobile: patch.mobile.trim(),
    username: patch.username.trim(),
    photoUrl: patch.photoUrl,
  };
  const previous = typeof window === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
  if (!write(next)) return false;

  const persisted = await replaceAdminProfileRequest(next);

  /**
   * Undo a write the server refused — the same guard `saveCustomCode` carries,
   * in the same store, and this one was left without it.
   *
   * `ensureAdminConfigHydrated` returns early once the gate has settled, so
   * nothing re-reads the server for the rest of the session. The rejected name
   * therefore sat in the cache, and on the next mount `useHydratedForm` loaded
   * it as BOTH the working copy and `saved` — so the form was clean, Save was
   * disabled, and the admin had no way to retry an edit they had been told
   * failed. The account menu read the same cache and greeted them by a name the
   * server had never accepted.
   *
   * Restored only if this write is still the one in the cache, so a concurrent
   * save the server DID accept is not destroyed.
   */
  if (!persisted && typeof window !== "undefined") {
    const stillOurs = localStorage.getItem(STORAGE_KEY) === JSON.stringify(next);
    if (stillOurs) {
      if (previous === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, previous);
      window.dispatchEvent(new Event(ADMIN_PROFILE_UPDATED_EVENT));
    }
  }

  return persisted;
}

/** Hydration: apply the server's saved profile fields locally (no re-push). */
export function persistServerAdminProfile(profile: Record<string, unknown>): void {
  write(profile as StoredProfile);
}
