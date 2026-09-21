"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { AccountNav } from "@/apps/website/account/components/account-nav";
import { StorePageHeader } from "@/apps/website/components/store-page-header";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";
import { cn } from "@/lib/utils";

interface AccountShellProps {
  /**
   * The page's `<h1>`. Still required, and still never drawn — `StorePageHeader`
   * keeps it in the document for search engines and screen readers.
   *
   * The `description` that used to sit beside it is gone rather than hidden.
   * All three were this software's own sentences — "Manage delivery addresses
   * for faster checkout." over a page of delivery addresses — so there was
   * nothing of the shop's to lose and nothing for a crawler to miss.
   */
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
  children: React.ReactNode;
}

export function AccountShell({ title, breadcrumbs = [], children }: AccountShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <StorePageHeader
        title={title}
        breadcrumbs={[{ label: "My Profile", href: routes.account.dashboard }, ...breadcrumbs]}
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
              className="mb-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:hidden"
            >
              <AccountNav onNavigate={() => setMobileOpen(false)} />
            </div>
          ) : null}

          <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
            <aside className="hidden lg:block">
              <div className="sticky top-24 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
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
