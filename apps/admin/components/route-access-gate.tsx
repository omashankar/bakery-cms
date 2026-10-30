"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldOff } from "lucide-react";

import { IntentLink as Link } from "@/components/shared/intent-link";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { useAccess } from "@/features/team/lib/access-context";
import { canOpenRoute, homeRoute } from "@/features/team/lib/route-access";

import { AdminPage } from "./admin-page";

/**
 * The screen a member opened, or "you don't have access" in its place.
 *
 * Client-side because a layout does not re-render on navigation between its
 * pages — a server check in the layout would run once and then wave every
 * soft navigation through. This is not what keeps data private: each screen's
 * server-rendered data is read through `whenAllowed` and every API checks its
 * own permission, so a member who defeats this gate gets an empty screen whose
 * requests answer 403.
 *
 * The dashboard is everyone's default landing page (sign-in sends you there),
 * so a member without it is taken to THEIR first screen instead of being told
 * no — kitchen staff land on the kitchen, riders on their deliveries.
 */
export function RouteAccessGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { access, can } = useAccess();

  const allowed = access ? canOpenRoute(pathname, can) : true;
  const home = useMemo(() => (access ? homeRoute(can) : routes.admin.dashboard), [access, can]);
  const isLanding = pathname === routes.admin.dashboard || pathname === routes.admin.root;
  const redirectHome = !allowed && isLanding && home !== pathname;

  useEffect(() => {
    if (redirectHome) router.replace(home);
  }, [redirectHome, home, router]);

  if (allowed) return <>{children}</>;
  if (redirectHome) return null;
  return <AccessDenied home={home} />;
}

export function AccessDenied({ home }: { home: string }) {
  const { access } = useAccess();
  return (
    <AdminPage>
      <div
        role="alert"
        className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-10 text-center"
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <ShieldOff className="size-5" aria-hidden />
        </span>
        <h1 className="text-lg font-semibold text-foreground">You don&apos;t have access to this page</h1>
        <p className="text-sm text-muted-foreground">
          {access?.roleName
            ? `Your role (${access.roleName}) doesn't include this part of the admin.`
            : "Your role doesn't include this part of the admin."}{" "}
          If you need it, ask the shop owner to change your role.
        </p>
        <Button render={<Link href={home} />} nativeButton={false} className="mt-1">
          Go to my home page
        </Button>
      </div>
    </AdminPage>
  );
}
