"use client";

import Link from "next/link";
import { useMemo } from "react";
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
import { useIsMobile } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

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
  const crumbs = useMemo(() => getAdminBreadcrumbs(pathname), [pathname]);
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
            <span key={`${crumb.label}-${index}`} className="contents">
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
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
