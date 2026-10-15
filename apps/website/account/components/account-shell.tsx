"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, Package, User } from "lucide-react";
import { AccountNav } from "@/apps/website/account/components/account-nav";
import { AccountProfileProvider, type AccountProfile } from "@/apps/website/account/components/account-context";
import { StorePageHeader } from "@/apps/website/components/store-page-header";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import { cn } from "@/lib/utils";

const TABS = [
  { href: routes.account.dashboard, label: "Profile", icon: User },
  { href: routes.account.orders, label: "Orders", icon: Package },
  { href: routes.account.addresses, label: "Addresses", icon: MapPin },
] as const;

interface AccountShellProps {
  account: AccountProfile;
  children: React.ReactNode;
}

/** Each tab's heading and its last crumb. */
const PAGES: Record<string, { title: string; crumb?: string }> = {
  [routes.account.dashboard]: { title: "My Profile" },
  [routes.account.orders]: { title: "My Orders", crumb: "Orders" },
  [routes.account.addresses]: { title: "Saved Addresses", crumb: "Addresses" },
};

/**
 * RENDERED ONCE, BY THE ACCOUNT LAYOUT — not by each page. Every page used to
 * wrap itself in this, so switching tabs threw the sidebar away and rebuilt
 * it: the avatar and name went blank and came back, which was the flash the
 * owner saw. Here it stays mounted and only the content beside it changes.
 */
export function AccountShell({ account, children }: AccountShellProps) {
  const pathname = usePathname() ?? "";
  const page = PAGES[pathname] ?? PAGES[routes.account.dashboard];
  const title = page.title;
  const breadcrumbs = page.crumb ? [{ label: page.crumb }] : [];

  return (
    <AccountProfileProvider value={account}>
      <StorePageHeader
        title={title}
        breadcrumbs={[{ label: "My Profile", href: routes.account.dashboard }, ...breadcrumbs]}
      />

      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.container}>
          {/*
            THREE TABS ON A PHONE, not a "Menu" button. There are three pages;
            hiding them behind a toggle made every move between them two taps
            and a hunt, and the page never said which one it was on.
          */}
          <nav aria-label="Account" className="mb-5 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 lg:hidden">
            {TABS.map((tab) => {
              const active =
                pathname === tab.href ||
                (tab.href !== routes.account.dashboard && pathname.startsWith(tab.href));
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors",
                    active ? "bg-card text-bakery-700 shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <tab.icon className="size-4" aria-hidden />
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="hidden lg:block">
              <div className="sticky top-24 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <AccountNav />
              </div>
            </aside>

            <div className={cn("min-w-0 space-y-6")}>{children}</div>
          </div>
        </div>
      </section>
    </AccountProfileProvider>
  );
}
