"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { hydrateSettingsFromServer } from "@/features/settings/lib/settings-repository";

/**
 * Hydrates local settings from the server once on mount, so the rest of the app
 * (business labels, module gating, commerce config) reflects the durable server
 * state instead of a stale per-browser copy.
 *
 * The read itself lives in `hydrateSettingsFromServer` rather than here, because
 * this mount is not the only thing that needs it: an admin who signs in through
 * the login form loads this layout while anonymous, and the soft navigation into
 * the admin never remounts it. Anything that is about to WRITE settings calls
 * the same function through `ensureSettingsHydrated`.
 *
 * The ADMIN-only half of that read is asked for only under /admin. This
 * component sits in the root providers, so it runs on every storefront page
 * too — where `/api/settings` requires a role a visitor does not have and could
 * only ever answer 401. Every customer was paying for two refused requests and
 * getting two console errors for them, before the public read that actually
 * serves the storefront. Skipping it changes nothing else: only a full read
 * opens the hydration gate, and `ensureSettingsHydrated` opens that on demand
 * before any write.
 *
 * Keyed on the pathname rather than `[]`, so the login form's soft navigation
 * into /admin — which never remounts this layout — now asks for the full read
 * at the moment it becomes askable.
 */
export function SettingsServerSync() {
  const pathname = usePathname();
  const privileged = pathname?.startsWith("/admin") ?? false;

  useEffect(() => {
    void hydrateSettingsFromServer({ privileged });
  }, [privileged]);

  return null;
}
