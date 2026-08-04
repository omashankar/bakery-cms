import { AlertTriangle } from "lucide-react";

import type { MaintenanceState } from "@/features/settings/server/maintenance.server";

/**
 * Tells an EXEMPT viewer that the shop they are browsing is closed to everyone
 * else, and why they can still see it.
 *
 * This used to BE maintenance mode: a client component that read localStorage,
 * rendered a yellow strip above a fully working storefront, and let customers
 * carry on buying. The closure itself now happens in the storefront layout, and
 * this exists only so an admin — or an allow-listed address — can tell at a
 * glance that visitors are not seeing what they are seeing.
 *
 * Server-driven for the same reason as the rest of the chrome: read from
 * localStorage it showed nothing in the HTML, appeared after hydration, and only
 * in a browser whose settings had already synced.
 */
export function MaintenanceBanner({ maintenance }: { maintenance: MaintenanceState }) {
  if (!maintenance.isEnabled || !maintenance.isExempt) return null;

  const because =
    maintenance.exemption === "admin"
      ? "You are signed in to the admin, so you can still browse."
      : "Your IP is on the allow-list, so you can still browse.";

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
      <div className="mx-auto flex max-w-7xl items-start gap-3 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p>
          <span className="font-medium">
            Maintenance mode is on — visitors cannot reach the store.
          </span>{" "}
          {because}
        </p>
      </div>
    </div>
  );
}
