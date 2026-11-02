"use client";

import Link from "next/link";
import { Fragment, useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { getAdminBreadcrumbs } from "@/lib/admin-breadcrumbs";
import { useBusinessLabels } from "@/hooks/use-business-labels";
import { useIsMobile } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { routes } from "@/constants/routes";
import { useAccess } from "@/features/team/lib/access-context";
import { canOpenRoute } from "@/features/team/lib/route-access";

function getVisibleCrumbs<T extends { label: string; href?: string }>(
  crumbs: T[],
  isMobile: boolean
): T[] {
  if (!isMobile || crumbs.length <= 3) return crumbs;
  return [crumbs[0], crumbs[crumbs.length - 1]];
}

interface AdminBreadcrumbsProps {
  className?: string;
}

export function AdminBreadcrumbs({ className }: AdminBreadcrumbsProps) {
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const labels = useBusinessLabels();
  // `labels` in the deps, or the trail keeps the wording from first paint and
  // never picks up the shop’s own after the settings fetch lands.
  // A crumb is a link only to a screen this member can open: the trail is
  // "Dashboard › Settings › Payments" for everyone, and for a manager or the
  // kitchen two of those are Access Denied pages. The root is dropped for a
  // member without the dashboard; the rest stay as plain words.
  const { access, can } = useAccess();
  const crumbs = useMemo(() => {
    const all = getAdminBreadcrumbs(pathname, labels);
    if (!access) return all;
    return all
      .filter((crumb, index) => !(index === 0 && crumb.href === routes.admin.dashboard && !can("dashboard.view") && all.length > 1))
      .map((crumb) => (crumb.href && !canOpenRoute(crumb.href, can) ? { ...crumb, href: undefined } : crumb));
  }, [pathname, labels, access, can]);
  const visibleCrumbs = useMemo(
    () => getVisibleCrumbs(crumbs, isMobile),
    [crumbs, isMobile]
  );
  const collapsed = isMobile && crumbs.length > 3;

  return (
    <Breadcrumb className={cn("min-w-0 text-muted-foreground", className)}>
      <BreadcrumbList className="flex-nowrap overflow-hidden text-xs sm:text-sm">
        {visibleCrumbs.map((crumb, index) => {
          const isLast = index === visibleCrumbs.length - 1;
          const showEllipsis = collapsed && index === 0;

          return (
            // A Fragment, not a wrapper: an <ol> may hold only <li>, and a span
            // around each pair made the trail an invalid list for screen readers.
            <Fragment key={`${crumb.label}-${index}`}>
              {index > 0 ? <BreadcrumbSeparator /> : null}
              {showEllipsis ? (
                <>
                  <BreadcrumbItem>
                    {crumb.href ? (
                      <BreadcrumbLink
                        className="max-w-[7rem] truncate sm:max-w-none"
                        render={<Link href={crumb.href} />}
                      >
                        {crumb.label}
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage className="max-w-[7rem] truncate sm:max-w-none">
                        {crumb.label}
                      </BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <span className="text-muted-foreground">…</span>
                  </BreadcrumbItem>
                </>
              ) : (
                <BreadcrumbItem>
                  {isLast || !crumb.href ? (
                    <BreadcrumbPage className="max-w-[9rem] truncate font-medium sm:max-w-none">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      className="max-w-[7rem] truncate sm:max-w-none"
                      render={<Link href={crumb.href} />}
                    >
                      {crumb.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              )}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
