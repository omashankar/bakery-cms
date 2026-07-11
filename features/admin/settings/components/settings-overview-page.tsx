"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronRight,
  Database,
  Globe,
  Mail,
  Phone,
  Settings,
  Share2,
  Shield,
  ShoppingBag,
  UserCog,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { routes } from "@/constants/routes";
import { AdminPage, AdminPageHeader } from "@/features/admin/components";
import { cn } from "@/lib/utils";
import {
  getGeneralSettings,
  getMaintenanceSettings,
} from "../lib/settings-repository";

type SettingsItem = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  future?: boolean;
};

type SettingsGroup = {
  title: string;
  items: SettingsItem[];
};

/** Only pages owned by Settings — no sidebar duplicates (Appearance, SEO, Taxes, Payments, Delivery). */
const groups: SettingsGroup[] = [
  {
    title: "Storefront",
    items: [
      {
        title: "General",
        description: "Site name, branding, timezone, and currency.",
        href: routes.admin.settings.general,
        icon: Settings,
      },
      {
        title: "Contact",
        description: "Business address, phone, email, and opening hours.",
        href: routes.admin.settings.contact,
        icon: Phone,
      },
      {
        title: "Social",
        description: "Social profile links shown in the footer.",
        href: routes.admin.settings.social,
        icon: Share2,
      },
      {
        title: "Maintenance",
        description: "Put the storefront in maintenance mode.",
        href: routes.admin.settings.maintenance,
        icon: Wrench,
      },
    ],
  },
  {
    title: "Commerce",
    items: [
      {
        title: "Commerce",
        description: "Delivery fees, free-shipping threshold, and gift wrap.",
        href: routes.admin.settings.commerce,
        icon: ShoppingBag,
      },
    ],
  },
  {
    title: "Communications",
    items: [
      {
        title: "SMTP",
        description: "Outbound email server for notifications.",
        href: routes.admin.settings.smtp,
        icon: Mail,
      },
      {
        title: "Analytics",
        description: "Google Analytics, GTM, and tracking pixels.",
        href: routes.admin.settings.analytics,
        icon: BarChart3,
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        title: "Security",
        description: "Session timeout, password policy, and login alerts.",
        href: routes.admin.settings.security,
        icon: Shield,
      },
      {
        title: "Activity",
        description: "Recent admin actions across the CMS.",
        href: routes.admin.settings.activity,
        icon: Activity,
      },
      {
        title: "Backup",
        description: "Export or import local CMS data.",
        href: routes.admin.settings.backup,
        icon: Database,
      },
      {
        title: "Permissions",
        description: "Team access control — available in a future release.",
        href: routes.admin.settings.permissions,
        icon: UserCog,
        future: true,
      },
    ],
  },
];

export function SettingsOverviewPage() {
  const [mounted, setMounted] = useState(false);
  const [siteName, setSiteName] = useState("Monginis");
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);

  useEffect(() => {
    const general = getGeneralSettings();
    const maintenance = getMaintenanceSettings();
    setSiteName(general.siteName);
    setMaintenanceEnabled(maintenance.isEnabled);
    setMounted(true);
  }, []);

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Settings"
        description={
          mounted
            ? `Site preferences for ${siteName}. Appearance, SEO, and Store Setup stay in the sidebar.`
            : "Site preferences for this bakery."
        }
        actions={
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            render={<Link href={routes.store.home} target="_blank" />}
            nativeButton={false}
          >
            <Globe className="size-4" />
            View storefront
          </Button>
        }
      />

      {mounted && maintenanceEnabled ? (
        <Link
          href={routes.admin.settings.maintenance}
          className="flex items-center gap-3 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 transition-colors hover:bg-amber-100/80 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
        >
          <AlertTriangle className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            Maintenance mode is on — storefront is paused.
          </span>
          <ChevronRight className="size-4 shrink-0 opacity-50" />
        </Link>
      ) : null}

      {!mounted ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="min-h-28 animate-pulse rounded-xl border border-border bg-muted"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card key={group.title} className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{group.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-1">
                <ul className="divide-y divide-border">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={cn(
                            "group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-6",
                            item.future && "opacity-70"
                          )}
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
                            <Icon className="size-4" strokeWidth={1.75} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium">{item.title}</p>
                              {item.future ? (
                                <Badge variant="outline" className="text-[10px]">
                                  Coming soon
                                </Badge>
                              ) : null}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {item.description}
                            </p>
                          </div>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground opacity-40 transition-transform group-hover:translate-x-0.5 group-hover:opacity-70" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
