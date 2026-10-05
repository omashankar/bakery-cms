"use client";

import { useState } from "react";
import { AdminPage, AdminPageHeader } from "@/apps/admin/components";
import { InquiriesListPage } from "./inquiries-list-page";
import { NewsletterSubscribersPage } from "./newsletter-subscribers-page";
import { cn } from "@/lib/utils";

type InquiryTab = "all" | "wedding" | "contact" | "newsletter";

const TABS: { id: InquiryTab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "wedding", label: "Wedding" },
  { id: "contact", label: "Contact" },
  { id: "newsletter", label: "Newsletter" },
];

/** Inquiries hub — in-page tabs replace the old sidebar submenu. */
export function InquiriesHubPage() {
  const [tab, setTab] = useState<InquiryTab>("all");
  /*
    The Wedding tab used to be hidden when the Wedding module was off. That
    module is gone with the builder and the page — but the enquiries are not:
    wedding cakes are a category the shop sells, and people are still asking
    about them. The tab always shows.
  */
  const tabs = TABS;

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Inquiries"
        description="Customer messages, wedding requests, and newsletter signups."
      />

      {/* Tabs */}
      <div className="-mx-1 overflow-x-auto px-1">
        <div className="flex w-max min-w-full gap-1 border-b border-border">
          {tabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "relative shrink-0 px-4 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "text-bakery-700"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
                {active ? (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-bakery-700" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel */}
      {tab === "newsletter" ? (
        <NewsletterSubscribersPage embedded />
      ) : (
        <InquiriesListPage
          key={tab}
          embedded
          fixedType={tab === "all" ? undefined : tab}
        />
      )}
    </AdminPage>
  );
}
