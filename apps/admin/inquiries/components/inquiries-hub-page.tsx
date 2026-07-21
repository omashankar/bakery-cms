"use client";

import { useEffect, useState } from "react";
import { AdminPage, AdminPageHeader } from "@/apps/admin/components";
import {
  isWeddingEnabled,
  SETTINGS_UPDATED_EVENT,
} from "@/features/settings/lib/settings-repository";
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
  // Wedding is bakery-only — hide that tab for other business types / module off.
  const [weddingEnabled, setWeddingEnabled] = useState(true);

  useEffect(() => {
    const sync = () => {
      const on = isWeddingEnabled();
      setWeddingEnabled(on);
      // If wedding was the active tab and it just got hidden, fall back to All.
      if (!on) setTab((current) => (current === "wedding" ? "all" : current));
    };
    sync();
    window.addEventListener(SETTINGS_UPDATED_EVENT, sync);
    return () => window.removeEventListener(SETTINGS_UPDATED_EVENT, sync);
  }, []);

  const tabs = weddingEnabled ? TABS : TABS.filter((t) => t.id !== "wedding");

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
