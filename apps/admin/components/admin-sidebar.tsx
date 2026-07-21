"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bell,
  Cake,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  Files,
  Flag,
  FolderOpen,
  Heart,
  Layers,
  LayoutGrid,
  HelpCircle,
  Home,
  Inbox,
  LayoutDashboard,
  List,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Newspaper,
  Package,
  Palette,
  PanelBottom,
  PanelTop,
  Plus,
  Quote,
  Receipt,
  Search,
  Settings,
  ShoppingBag,
  Star,
  Tag,
  Tags,
  Truck,
  Undo2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { BakeryCmsBrand } from "@/components/shared/bakery-cms-brand";
import { adminNavSections, type AdminNavItem, type NavItem } from "@/constants/navigation";
import { routes } from "@/constants/routes";
import { isSettingsOwnedPath } from "@/lib/admin-settings-pages";
import { countNewInquiries } from "@/apps/admin/inquiries";
import {
  countInventoryAlerts,
  INVENTORY_UPDATED_EVENT,
} from "@/apps/admin/commerce/lib/inventory-repository";
import {
  countUnreadNotifications,
  NOTIFICATIONS_UPDATED_EVENT,
  syncNotifications,
} from "@/apps/admin/commerce/lib/notifications-repository";
import { INQUIRIES_UPDATED_EVENT } from "@/features/inquiries/lib/inquiries-repository";
import {
  getGeneralSettings,
  getModuleSettings,
  SETTINGS_UPDATED_EVENT,
} from "@/features/settings/lib/settings-repository";
import { useBusinessLabels } from "@/hooks/use-business-labels";
import { cn } from "@/lib/utils";
import { adminShell } from "./admin-shell";

const navRow = adminShell.navRow;
const navActive = adminShell.navActive;
const navIdle = adminShell.navIdle;

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Cake,
  Tags,
  Flag,
  Quote,
  HelpCircle,
  Home,
  Heart,
  FileText,
  PanelTop,
  PanelBottom,
  Search,
  FolderOpen,
  MessageSquare,
  Palette,
  Settings,
  ShoppingBag,
  Star,
  BarChart3,
  Tag,
  Users,
  List,
  Plus,
  Files,
  Inbox,
  Mail,
  MessageCircle,
  Newspaper,
  ChevronRight,
  Package,
  CreditCard,
  MapPin,
  Clock,
  Receipt,
  Truck,
  Bell,
  Undo2,
  Layers,
  LayoutGrid,
};

interface AdminSidebarProps {
  collapsed: boolean;
  inDrawer?: boolean;
  onNavigate?: () => void;
  className?: string;
}

function isChildLinkActive(
  pathname: string,
  childHref: string,
  siblings: NavItem[]
): boolean {
  if (pathname === childHref) return true;

  const hasExactSibling = siblings.some((sibling) => pathname === sibling.href);
  if (hasExactSibling) return false;

  return pathname.startsWith(`${childHref}/`);
}

function findOpenMenuHref(pathname: string): string | null {
  for (const section of adminNavSections) {
    for (const item of section.items) {
      if (!item.children?.length) continue;

      const childActive = item.children.some((child) =>
        isChildLinkActive(pathname, child.href, item.children ?? [])
      );

      if (
        childActive ||
        pathname === item.href ||
        pathname.startsWith(`${item.href}/`)
      ) {
        return item.href;
      }
    }
  }

  return null;
}

function useNavActiveState(item: AdminNavItem) {
  const pathname = usePathname();

  return useMemo(() => {
    const childActive = item.children?.some((child) =>
      isChildLinkActive(pathname, child.href, item.children ?? [])
    );
    // Config pages that moved into Settings keep the "Settings" item highlighted.
    const settingsActive =
      item.href === routes.admin.settings.overview && isSettingsOwnedPath(pathname);
    const parentActive =
      pathname === item.href ||
      pathname.startsWith(`${item.href}/`) ||
      Boolean(childActive) ||
      settingsActive;

    return { pathname, parentActive, childActive };
  }, [item, pathname]);
}

function NavIcon({
  icon,
  active,
  className,
}: {
  icon: LucideIcon;
  active?: boolean;
  className?: string;
}) {
  const Icon = icon;
  return (
    <Icon
      className={cn(
        "size-4 shrink-0",
        active
          ? "text-current"
          : "text-muted-foreground group-hover/navrow:text-sidebar-accent-foreground",
        className
      )}
      strokeWidth={1.75}
    />
  );
}

function SubNavLink({
  sub,
  pathname,
  siblings,
  onNavigate,
}: {
  sub: NavItem;
  pathname: string;
  siblings: NavItem[];
  onNavigate?: () => void;
}) {
  // All submenu items use a consistent chevron-right indicator.
  const SubIcon = ChevronRight;
  const subActive = isChildLinkActive(pathname, sub.href, siblings);

  return (
    <Link
      href={sub.href}
      onClick={onNavigate}
      aria-current={subActive ? "page" : undefined}
      className={cn(navRow, "group/navrow gap-2.5 px-3", subActive ? navActive : navIdle)}
    >
      <NavIcon icon={SubIcon} active={subActive} />
      <span className="min-w-0 flex-1 truncate">{sub.label}</span>
    </Link>
  );
}

function NavItem({
  item,
  collapsed,
  isOpen,
  onToggle,
  onNavigate,
  inquiryBadge,
  inventoryBadge,
  notificationBadge,
  iconOverride,
}: {
  item: AdminNavItem;
  collapsed: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
  inquiryBadge?: number;
  inventoryBadge?: number;
  notificationBadge?: number;
  iconOverride?: LucideIcon;
}) {
  const Icon = iconOverride ?? iconMap[item.icon] ?? LayoutDashboard;
  const { pathname, parentActive } = useNavActiveState(item);
  const hasChildren = Boolean(item.children?.length);
  const showBadge = inquiryBadge && inquiryBadge > 0 && item.icon === "MessageSquare";
  const showInventoryBadge =
    inventoryBadge && inventoryBadge > 0 && item.href.includes("/commerce/inventory");
  const showNotificationBadge =
    notificationBadge && notificationBadge > 0 && item.href.includes("/commerce/notifications");
  const isLeafActive = parentActive && !hasChildren;

  if (collapsed) {
    return (
      <div className="group relative w-full">
        <Link
          href={item.href}
          onClick={onNavigate}
          title={item.label}
          aria-label={item.label}
          aria-haspopup={hasChildren ? "menu" : undefined}
          aria-current={parentActive ? "page" : undefined}
          className={cn(
            "relative mx-auto flex size-9 items-center justify-center rounded-lg transition-premium",
            parentActive ? navActive : navIdle
          )}
        >
          <Icon className="size-[18px]" strokeWidth={1.75} />
          {showNotificationBadge ? (
            <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-destructive ring-2 ring-sidebar" />
          ) : showInventoryBadge ? (
            <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-amber-500 ring-2 ring-sidebar" />
          ) : showBadge ? (
            <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-destructive ring-2 ring-sidebar" />
          ) : null}
        </Link>

        {hasChildren ? (
          <div className="pointer-events-none absolute top-0 left-full z-50 hidden pl-2 group-hover:pointer-events-auto group-hover:block group-focus-within:pointer-events-auto group-focus-within:block">
            <div className="w-52 overflow-hidden rounded-lg border border-sidebar-border bg-popover p-1 shadow-sm">
              <p className="px-3 py-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                {item.label}
              </p>
              {item.children?.map((sub) => (
                <SubNavLink
                  key={sub.href}
                  sub={sub}
                  pathname={pathname}
                  siblings={item.children ?? []}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (!hasChildren) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        aria-current={isLeafActive ? "page" : undefined}
        className={cn(navRow, "group/navrow gap-3 px-3", isLeafActive ? navActive : navIdle)}
      >
        <NavIcon icon={Icon} active={isLeafActive} className="size-[18px]" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {showNotificationBadge ? (
          <span className="shrink-0 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {notificationBadge}
          </span>
        ) : showInventoryBadge ? (
          <span className="shrink-0 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {inventoryBadge}
          </span>
        ) : showBadge ? (
          <span className="shrink-0 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
            {inquiryBadge}
          </span>
        ) : null}
      </Link>
    );
  }

  return (
    <div className="w-full space-y-0.5">
      <div
        className={cn(
          navRow,
          "overflow-hidden pr-1",
          parentActive
            ? "bg-sidebar-accent text-sidebar-foreground"
            : navIdle
        )}
      >
        <Link
          href={item.href}
          onClick={onNavigate}
          aria-current={parentActive ? "true" : undefined}
          className="group/navrow flex h-9 min-w-0 flex-1 items-center gap-3 px-3"
        >
          <NavIcon icon={Icon} className="size-[18px]" />
          <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
          {showNotificationBadge ? (
            <span className="shrink-0 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              {notificationBadge}
            </span>
          ) : showInventoryBadge ? (
            <span className="shrink-0 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              {inventoryBadge}
            </span>
          ) : showBadge ? (
            <span className="shrink-0 rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              {inquiryBadge}
            </span>
          ) : null}
        </Link>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onToggle();
          }}
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-premium hover:bg-sidebar-accent hover:text-foreground"
          aria-expanded={isOpen}
          aria-label={`${isOpen ? "Collapse" : "Expand"} ${item.label} menu`}
        >
          <ChevronDown
            className={cn("size-4 transition-transform duration-200", isOpen && "rotate-180")}
          />
        </button>
      </div>

      {isOpen ? (
        <div className="ml-2 space-y-0.5 border-l border-sidebar-border/80 pl-1.5">
          {item.children?.map((sub) => (
            <SubNavLink
              key={sub.href}
              sub={sub}
              pathname={pathname}
              siblings={item.children ?? []}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AdminSidebar({ collapsed, inDrawer, onNavigate, className }: AdminSidebarProps) {
  const pathname = usePathname();
  const [inquiryBadge, setInquiryBadge] = useState(0);
  const [inventoryBadge, setInventoryBadge] = useState(0);
  const [notificationBadge, setNotificationBadge] = useState(0);
  // Wedding Builder is bakery-only: hidden for other business types or when the
  // module is off. Hidden from the sidebar only — the route/page still exist.
  const [hideWedding, setHideWedding] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(() => findOpenMenuHref(pathname));

  useEffect(() => {
    function refreshBadges() {
      setInquiryBadge(countNewInquiries());
      setInventoryBadge(countInventoryAlerts());
      syncNotifications();
      setNotificationBadge(countUnreadNotifications());
    }

    function refreshModules() {
      const isBakery = getGeneralSettings().businessType === "bakery";
      setHideWedding(!isBakery || !getModuleSettings().weddingBuilder);
    }

    refreshBadges();
    refreshModules();

    window.addEventListener(INVENTORY_UPDATED_EVENT, refreshBadges);
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refreshBadges);
    window.addEventListener(INQUIRIES_UPDATED_EVENT, refreshBadges);
    window.addEventListener("bakery-orders-updated", refreshBadges);
    window.addEventListener(SETTINGS_UPDATED_EVENT, refreshModules);

    return () => {
      window.removeEventListener(INVENTORY_UPDATED_EVENT, refreshBadges);
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refreshBadges);
      window.removeEventListener(INQUIRIES_UPDATED_EVENT, refreshBadges);
      window.removeEventListener("bakery-orders-updated", refreshBadges);
      window.removeEventListener(SETTINGS_UPDATED_EVENT, refreshModules);
    };
  }, []);

  const labels = useBusinessLabels();
  const navSections = useMemo(() => {
    return adminNavSections.map((section) => ({
      ...section,
      items: section.items
        .filter((item) => !hideWedding || item.href !== routes.admin.builders.wedding)
        // Relabel the "Cakes" catalog item for the current business type — the
        // route/component stay named "cakes"; only the visible label changes.
        .map((item) =>
          item.href === routes.admin.cakes.list
            ? { ...item, label: labels.productWordPlural }
            : item
        ),
    }));
  }, [hideWedding, labels]);

  useEffect(() => {
    setOpenMenu(findOpenMenuHref(pathname));
  }, [pathname]);

  const handleToggle = (href: string) => {
    setOpenMenu((current) => (current === href ? null : href));
  };

  return (
    <div className={cn("flex h-full min-h-0 w-full flex-col", adminShell.sidebarBg, className)}>
      <div
        className={cn(
          "flex shrink-0 items-center border-b",
          adminShell.border,
          adminShell.chromeHeight,
          collapsed ? "justify-center px-2" : "px-4",
          inDrawer ? "pr-11" : ""
        )}
      >
        <BakeryCmsBrand
          href={routes.admin.dashboard}
          subtitle="Admin Panel"
          size="sm"
          collapsed={collapsed}
          onNavigate={onNavigate}
          className="w-full"
        />
      </div>

      <nav
        className={cn(
          "sidebar-scroll w-full min-h-0 flex-1 overflow-y-auto overscroll-contain",
          collapsed ? "space-y-1 px-2 py-3" : "space-y-0.5 px-2.5 py-3 pr-1"
        )}
        aria-label="Admin navigation"
      >
        {navSections.map((section, sectionIndex) => (
          <div
            key={section.title || "root"}
            className={cn("w-full", sectionIndex > 0 && !collapsed ? "mt-4" : "")}
          >
            {sectionIndex > 0 && collapsed ? (
              <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border" aria-hidden />
            ) : null}

            {!collapsed && section.title ? (
              <p className="mb-1.5 px-3 text-[10px] font-bold tracking-[0.1em] text-muted-foreground uppercase">
                {section.title}
              </p>
            ) : null}

            <div className={cn("w-full", collapsed ? "space-y-1" : "space-y-0.5")}>
              {section.items.map((item) => (
                <NavItem
                  key={`${section.title}-${item.label}-${item.href}`}
                  item={item}
                  collapsed={collapsed}
                  isOpen={!collapsed && openMenu === item.href}
                  onToggle={() => handleToggle(item.href)}
                  onNavigate={onNavigate}
                  inquiryBadge={item.icon === "MessageSquare" ? inquiryBadge : undefined}
                  inventoryBadge={
                    item.href.includes("/commerce/inventory") ? inventoryBadge : undefined
                  }
                  notificationBadge={
                    item.href.includes("/commerce/notifications") ? notificationBadge : undefined
                  }
                  iconOverride={
                    item.href === routes.admin.cakes.list ? labels.productIcon : undefined
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn("shrink-0 border-t px-3 py-2.5", adminShell.border, "bg-sidebar")}>
        {collapsed ? (
          <Link
            href={routes.store.home}
            onClick={onNavigate}
            title="View Storefront"
            aria-label="View Storefront"
            className="mx-auto flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-premium hover:bg-sidebar-accent hover:text-foreground"
          >
            <ExternalLink className="size-4" strokeWidth={1.75} />
          </Link>
        ) : (
          <Link
            href={routes.store.home}
            onClick={onNavigate}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent text-xs font-medium text-muted-foreground transition-premium hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
            View Storefront
          </Link>
        )}
      </div>
    </div>
  );
}
