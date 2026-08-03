"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Blocks,
  ChevronRight,
  Code2,
  CreditCard,
  Database,
  FileCode2,
  FileText,
  Globe,
  Mail,
  Menu,
  MessageCircle,
  Palette,
  Smartphone,
  PanelBottom,
  PanelTop,
  Phone,
  Receipt,
  Search,
  Settings,
  Share2,
  Shield,
  ShoppingBag,
  Truck,
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
import { AdminPage, AdminPageHeader } from "@/apps/admin/components";
import { cn } from "@/lib/utils";
import {
  ensureSettingsHydrated,
  getGeneralSettings,
  getMaintenanceSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/features/settings/lib/settings-repository";
import { settingsHydration } from "@/features/settings/lib/settings-api";

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

/**
 * Settings is the CMS control center — every configuration page is reachable here.
 * Routes are unchanged; Settings simply links to the existing pages (some live under
 * /admin/commerce or /admin/header etc.) so the sidebar can stay short.
 */
const groups: SettingsGroup[] = [
  {
    title: "Store",
    items: [
      {
        title: "General",
        description: "Store name, logo, timezone, currency, and business type.",
        href: routes.admin.settings.general,
        icon: Settings,
      },
      {
        title: "Modules",
        description: "Enable optional bakery features — flavour, weight, shape, and wedding builder.",
        href: routes.admin.settings.modules,
        icon: Blocks,
      },
      {
        title: "Contact Information",
        description: "Business address, phone, email, and business hours.",
        href: routes.admin.settings.contact,
        icon: Phone,
      },
      {
        title: "Social Media",
        description: "Social profile links shown in the footer.",
        href: routes.admin.settings.social,
        icon: Share2,
      },
      {
        title: "Maintenance Mode",
        description: "Pause the storefront for updates.",
        href: routes.admin.settings.maintenance,
        icon: Wrench,
      },
    ],
  },
  {
    title: "Commerce",
    items: [
      {
        title: "Payments",
        description: "Gateways, transactions, refunds, and payment analytics.",
        href: routes.admin.commerce.payments,
        icon: CreditCard,
      },
      {
        title: "Delivery",
        description: "Delivery zones, time slots, and shipping rules.",
        href: routes.admin.commerce.deliveryZones,
        icon: Truck,
      },
      {
        title: "Taxes",
        description: "GST / tax rates applied at checkout.",
        href: routes.admin.commerce.taxes,
        icon: Receipt,
      },
      {
        title: "Invoices",
        description: "Invoice designer, numbering, and branding.",
        href: routes.admin.commerce.invoices,
        icon: FileText,
      },
      {
        title: "Order Settings",
        description: "Gift wrap, minimum order, and free-delivery rules.",
        href: routes.admin.settings.commerce,
        icon: ShoppingBag,
      },
    ],
  },
  {
    title: "Communication",
    items: [
      {
        title: "SMTP",
        description: "Outbound email server for notifications.",
        href: routes.admin.settings.smtp,
        icon: Mail,
      },
      {
        title: "Email Templates",
        description: "Transactional email content and branding.",
        href: routes.admin.commerce.emails,
        icon: Mail,
      },
      {
        title: "WhatsApp Templates",
        // NOT "for order updates". Nothing in this codebase sends a WhatsApp
        // message — the screen is a template editor with no provider behind
        // it — and describing it next to a genuinely shipped Email entry, with
        // SMS below it correctly flagged "coming soon", read as the one in the
        // middle being live.
        description: "Draft WhatsApp copy — sending not connected yet.",
        href: routes.admin.commerce.whatsapp,
        icon: MessageCircle,
        future: true,
      },
      {
        title: "SMS Notifications",
        description: "Send order updates over SMS — coming soon.",
        href: routes.admin.settings.sms,
        icon: Smartphone,
        future: true,
      },
    ],
  },
  {
    title: "Website",
    items: [
      {
        title: "Appearance",
        description: "Theme colours, fonts, and storefront styling.",
        href: routes.admin.appearance,
        icon: Palette,
      },
      {
        title: "Header",
        description: "Storefront navigation, logo, and top bar.",
        href: routes.admin.header,
        icon: PanelTop,
      },
      {
        title: "Footer",
        description: "Footer links, contact block, and social row.",
        href: routes.admin.footer,
        icon: PanelBottom,
      },
      {
        title: "SEO",
        description: "Meta tags, titles, and search visibility.",
        href: routes.admin.seo,
        icon: Search,
      },
      {
        title: "Analytics",
        description: "Google Analytics, GTM, and tracking pixels.",
        href: routes.admin.settings.analytics,
        icon: BarChart3,
      },
      {
        title: "Navigation Menus",
        description: "Build storefront navigation menus — coming soon.",
        href: routes.admin.settings.navigation,
        icon: Menu,
        future: true,
      },
      {
        title: "Custom Code",
        description: "Inject custom CSS and JavaScript.",
        href: routes.admin.settings.customCode,
        icon: Code2,
      },
      {
        title: "Robots.txt & Sitemap",
        description: "Search-engine crawling and indexing — coming soon.",
        href: routes.admin.settings.seoFiles,
        icon: FileCode2,
        future: true,
      },
    ],
  },
  {
    title: "Security",
    items: [
      {
        title: "Login Security",
        description: "Session timeout, password policy, and login alerts.",
        href: routes.admin.settings.security,
        icon: Shield,
      },
      {
        title: "Activity Logs",
        description: "Recent admin actions across the CMS.",
        href: routes.admin.settings.activity,
        icon: Activity,
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
  {
    title: "Backup",
    items: [
      {
        title: "Backup & Restore",
        description: "Export, import, and restore local CMS data.",
        href: routes.admin.settings.backup,
        icon: Database,
      },
    ],
  },
];

export function SettingsOverviewPage() {
  // This page writes nothing, so it cannot clobber anything — but it makes two
  // CLAIMS from the same unhydrated local store the forms do, and one of them
  // matters. `mounted` flipped true in the same tick as a synchronous read, so
  // before hydration landed the header named the demo shop and, worse, the
  // maintenance banner stayed hidden: an admin was told the storefront was open
  // while it may have been closed to every customer.
  //
  // Both claims now wait for the server's copy. "Loading" is a smaller lie than
  // "everything is fine".
  // TWO different questions, and conflating them blanked this page.
  //
  //  - `mounted`: has the client rendered? The section list below is static
  //    navigation — it has nothing to do with settings values, and gating it on
  //    anything else leaves an admin staring at four grey rectangles. Its only
  //    job is avoiding a server/client mismatch on first paint.
  //  - `hydrated`: has the SERVER's copy arrived? Only the two CLAIMS wait on
  //    this — the shop's name, and whether maintenance mode is on.
  const [mounted, setMounted] = useState(false);
  const [hydrated, setHydrated] = useState(settingsHydration.hasSettled());
  const [siteName, setSiteName] = useState("");
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    function read() {
      setSiteName(getGeneralSettings().siteName);
      setMaintenanceEnabled(getMaintenanceSettings().isEnabled);
    }

    read();
    setMounted(true);
    window.addEventListener(SETTINGS_UPDATED_EVENT, read);

    void ensureSettingsHydrated().then((settled) => {
      if (cancelled) return;
      if (settled) read();
      // Only a SUCCESSFUL read may unlock the claims. `ensureSettingsHydrated`
      // reports false when the FULL admin read failed even if the public subset
      // landed — so this legitimately stays false, and the claims stay generic
      // rather than reporting this browser's defaults as fact.
      setHydrated(settled);
    });

    return () => {
      cancelled = true;
      window.removeEventListener(SETTINGS_UPDATED_EVENT, read);
    };
  }, []);

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Settings"
        description={
          // The shop's NAME is a claim, so it waits for the server's copy.
          hydrated && siteName
            ? `The control center for ${siteName} — store, commerce, communication, website, and security.`
            : "The control center for this bakery."
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

      {/*
        Also a claim, and the one that matters: showing nothing here means "the
        storefront is open". Before hydration that would be the local seed
        talking, so the banner waits for the server rather than reassuring an
        admin whose shop may be closed to every customer.
      */}
      {hydrated && maintenanceEnabled ? (
        <Link
          href={routes.admin.settings.maintenance}
          className="flex items-center gap-3 rounded-xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 transition-colors hover:bg-amber-100/80 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/60"
        >
          <AlertTriangle className="size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            Maintenance mode is on — visitors cannot reach the store.
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
