"use client";

import { cn } from "@/lib/utils";
import { adminShell } from "./admin-shell";

interface AdminPageProps {
  children: React.ReactNode;
  className?: string;
}

/** Consistent vertical rhythm for admin feature pages */
export function AdminPage({ children, className }: AdminPageProps) {
  return <div className={cn(adminShell.pageStack, className)}>{children}</div>;
}

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
  className?: string;
}

/** Shared page title block aligned with admin shell */
export function AdminPageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: AdminPageHeaderProps) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-4",
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        {eyebrow ? (
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {actions}
        </div>
      ) : null}
    </section>
  );
}

interface AdminMobileActionBarProps {
  children: React.ReactNode;
  className?: string;
}

/** Sticky bottom action bar on mobile for save-heavy pages */
export function AdminMobileActionBar({ children, className }: AdminMobileActionBarProps) {
  return <section className={cn(adminShell.mobileActionBar, className)}>{children}</section>;
}

export { adminShell };
