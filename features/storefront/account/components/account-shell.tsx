"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { AccountNav } from "@/features/storefront/account/components/account-nav";
import { StorePageHeader } from "@/features/storefront/components/store-page-header";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import { cn } from "@/lib/utils";

interface AccountShellProps {
  title: string;
  description?: string;
  breadcrumbs?: { label: string; href?: string }[];
  children: React.ReactNode;
}

export function AccountShell({
  title,
  description,
  breadcrumbs = [],
  children,
}: AccountShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <StorePageHeader
        title={title}
        description={description}
        breadcrumbs={[{ label: "My Account", href: routes.account.dashboard }, ...breadcrumbs]}
      />

      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.container}>
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <p className="text-sm font-medium text-muted-foreground">Account menu</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileOpen((open) => !open)}
              aria-expanded={mobileOpen}
              aria-controls="account-mobile-nav"
              aria-label={mobileOpen ? "Close account menu" : "Open account menu"}
            >
              {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
              Menu
            </Button>
          </div>

          {mobileOpen ? (
            <div
              id="account-mobile-nav"
              className="mb-6 rounded-xl border border-border bg-white p-4 lg:hidden"
            >
              <AccountNav onNavigate={() => setMobileOpen(false)} />
            </div>
          ) : null}

          <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
            <aside className="hidden lg:block">
              <div className="sticky top-24 rounded-xl border border-border bg-white p-4 shadow-sm">
                <AccountNav />
              </div>
            </aside>

            <div className={cn("min-w-0 space-y-6")}>{children}</div>
          </div>
        </div>
      </section>
    </>
  );
}
