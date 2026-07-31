import Link from "next/link";
import { LayoutDashboard, PackageX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";

/**
 * The 404 for `notFound()` thrown inside an admin route.
 *
 * Without it, the ROOT boundary answered — a storefront-flavoured 404 whose only
 * action was "Back to Store", i.e. it threw the admin out of the admin.
 *
 * Next renders a not-found boundary outside this route group's layout, so this
 * does NOT get the sidebar and header (verified against a running build); the
 * links below are the way back. Anywhere the destination is knowable, prefer a
 * `redirect()` to the screen that explains the situation — the wedding builder
 * sends a module-disabled admin to Settings → Modules for exactly that reason.
 */
export default function AdminNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <PackageX className="size-6" />
      </span>
      <div className="space-y-1.5">
        <h1 className="font-heading text-xl font-bold sm:text-2xl">This page isn&apos;t available</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          It may have been moved, or it belongs to a module that is currently switched off in
          Settings → Modules.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="bakery" render={<Link href={routes.admin.dashboard} />}>
          <LayoutDashboard className="size-4" />
          Back to dashboard
        </Button>
        <Button variant="outline" render={<Link href={routes.admin.settings.modules} />}>
          Open module settings
        </Button>
      </div>
    </div>
  );
}
