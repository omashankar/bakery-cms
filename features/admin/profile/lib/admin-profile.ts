"use client";

import { getDemoSession } from "@/features/auth/lib/session";

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

/** Fully-resolved profile (session email + saved fields + sensible defaults). */
export function getAdminProfile(): AdminProfile {
  const email = getDemoSession()?.email ?? "owner@bakery.com";
  const saved = read();

  // Seed created/last-login once so the demo shows realistic values.
  if (!saved.createdAt || !saved.lastLogin) {
    const now = new Date();
    const created = new Date(now.getFullYear() - 1, 0, 15).toISOString();
    write({
      ...saved,
      createdAt: saved.createdAt ?? created,
      lastLogin: saved.lastLogin ?? now.toISOString(),
    });
  }
  const merged = read();

  return {
    fullName: merged.fullName ?? nameFromEmail(email),
    email,
    mobile: merged.mobile ?? "",
    username: merged.username ?? "",
    photoUrl: merged.photoUrl ?? "",
    role: "Administrator",
    status: "Active",
    lastLogin: merged.lastLogin ?? new Date().toISOString(),
    createdAt: merged.createdAt ?? new Date().toISOString(),
  };
}

/** Returns false when the write was refused (e.g. photo too large for the quota). */
export function saveAdminProfile(
  patch: Pick<AdminProfile, "fullName" | "mobile" | "username" | "photoUrl">
): boolean {
  const saved = read();
  return write({
    ...saved,
    fullName: patch.fullName.trim(),
    mobile: patch.mobile.trim(),
    username: patch.username.trim(),
    photoUrl: patch.photoUrl,
  });
}
