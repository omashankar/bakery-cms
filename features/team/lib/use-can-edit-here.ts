"use client";

import { usePathname } from "next/navigation";

import { useAccess } from "./access-context";
import { canEditRoute } from "./route-access";

/**
 * May the signed-in member change things on the screen they are on? For the
 * SHARED save controls (the settings shell, hydrated forms), so a view-only
 * role gets a read-only screen instead of a Save button that answers 403.
 *
 * Outside the admin shell (a test rendering one form alone) there is no
 * member to judge, and the form keeps the behaviour it had before roles —
 * the API is what refuses.
 */
export function useCanEditHere(): boolean {
  const pathname = usePathname() ?? "";
  const { access, can } = useAccess();
  if (!access) return true;
  return canEditRoute(pathname, can);
}
