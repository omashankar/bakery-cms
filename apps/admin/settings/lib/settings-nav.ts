import {
  Activity,
  BarChart3,
  Blocks,
  Database,
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
import { routes } from "@/constants/routes";

export type SettingsNavItem = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  future?: boolean;
};

export type SettingsNavGroup = {
  title: string;
  items: SettingsNavItem[];
};

/** Left-rail tabs for the Settings workspace (settings-owned routes only). */
export const settingsNavGroups: SettingsNavGroup[] = [
  {
    title: "Storefront",
    items: [
      {
        id: "general",
        label: "General",
        href: routes.admin.settings.general,
        icon: Settings,
      },
      {
        id: "modules",
        label: "Modules",
        href: routes.admin.settings.modules,
        icon: Blocks,
      },
      {
        id: "contact",
        label: "Contact",
        href: routes.admin.settings.contact,
        icon: Phone,
      },
      {
        id: "social",
        label: "Social",
        href: routes.admin.settings.social,
        icon: Share2,
      },
      {
        id: "maintenance",
        label: "Maintenance",
        href: routes.admin.settings.maintenance,
        icon: Wrench,
      },
    ],
  },
  {
    title: "Commerce",
    items: [
      {
        id: "commerce",
        label: "Commerce",
        href: routes.admin.settings.commerce,
        icon: ShoppingBag,
      },
    ],
  },
  {
    title: "Communications",
    items: [
      {
        id: "smtp",
        label: "SMTP",
        href: routes.admin.settings.smtp,
        icon: Mail,
      },
      {
        id: "analytics",
        label: "Analytics",
        href: routes.admin.settings.analytics,
        icon: BarChart3,
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        id: "security",
        label: "Security",
        href: routes.admin.settings.security,
        icon: Shield,
      },
      {
        id: "activity",
        label: "Activity",
        href: routes.admin.settings.activity,
        icon: Activity,
      },
      {
        id: "backup",
        label: "Backup",
        href: routes.admin.settings.backup,
        icon: Database,
      },
      {
        id: "permissions",
        label: "Permissions",
        href: routes.admin.settings.permissions,
        icon: UserCog,
        future: true,
      },
    ],
  },
];

export const settingsNavItems = settingsNavGroups.flatMap((group) => group.items);

export function getSettingsNavItem(pathname: string): SettingsNavItem | undefined {
  return settingsNavItems.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  );
}
