import { routes } from "./routes";

export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  badge?: string;
  children?: NavItem[];
}

/** Public storefront navigation */
export const storefrontNav: NavItem[] = [
  { label: "Home", href: routes.store.home },
  { label: "Collections", href: routes.store.collections },
  { label: "Wedding Cakes", href: routes.store.weddingCakes },
  { label: "About", href: routes.store.about },
  { label: "Gallery", href: routes.store.gallery },
  { label: "Contact", href: routes.store.contact },
  { label: "FAQ", href: routes.store.faq },
];

export interface AdminNavItem extends NavItem {
  icon: string;
}

export interface AdminNavSection {
  title: string;
  items: AdminNavItem[];
}

/**
 * Admin sidebar IA — simple flow:
 * Overview → Sales → Products → Store Setup → Website → System
 */
export const adminNavSections: AdminNavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: routes.admin.dashboard, icon: "LayoutDashboard" },
      { label: "Notifications", href: routes.admin.commerce.notifications, icon: "Bell" },
    ],
  },
  {
    title: "Sales",
    items: [
      { label: "Orders", href: routes.admin.orders.list, icon: "ShoppingBag" },
      { label: "Customers", href: routes.admin.customers.list, icon: "Users" },
      // Inquiries uses in-page tabs (All / Wedding / Contact / Newsletter) — no submenu.
      { label: "Inquiries", href: routes.admin.inquiries.overview, icon: "MessageSquare" },
    ],
  },
  {
    title: "Catalog",
    items: [
      { label: "Cakes", href: routes.admin.cakes.list, icon: "Cake" },
      // Catalog uses in-page tabs (Categories / Occasions / Themes / Flavours / Weights).
      { label: "Catalog", href: routes.admin.catalog, icon: "Tags" },
      { label: "Inventory", href: routes.admin.commerce.inventory, icon: "Package" },
      { label: "Reviews", href: routes.admin.commerce.reviews, icon: "Star" },
    ],
  },
  {
    title: "Website",
    items: [
      { label: "Homepage Builder", href: routes.admin.builders.homepage, icon: "Home" },
      { label: "Wedding Builder", href: routes.admin.builders.wedding, icon: "Heart" },
      { label: "Pages", href: routes.admin.pages.list, icon: "FileText" },
      { label: "Media Library", href: routes.admin.media, icon: "FolderOpen" },
      { label: "Banners", href: routes.admin.banners, icon: "Flag" },
      { label: "Testimonials", href: routes.admin.testimonials, icon: "Quote" },
      { label: "FAQ", href: routes.admin.faq, icon: "HelpCircle" },
    ],
  },
  {
    title: "Marketing",
    items: [{ label: "Coupons", href: routes.admin.commerce.coupons, icon: "Tag" }],
  },
  {
    title: "System",
    items: [
      { label: "Reports", href: routes.admin.reports, icon: "BarChart3" },
      // Settings is the control center — Payments, Delivery, Taxes, Invoices, Templates,
      // Header, Footer, Appearance, SEO, Security, Backup all live inside it.
      { label: "Settings", href: routes.admin.settings.overview, icon: "Settings" },
    ],
  },
];
