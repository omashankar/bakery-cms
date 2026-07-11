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
      {
        label: "Dashboard",
        href: routes.admin.dashboard,
        icon: "LayoutDashboard",
      },
      {
        label: "Reports",
        href: routes.admin.reports,
        icon: "BarChart3",
      },
      {
        label: "Notifications",
        href: routes.admin.commerce.notifications,
        icon: "Bell",
      },
    ],
  },
  {
    title: "Sales",
    items: [
      {
        label: "Orders",
        href: routes.admin.orders.list,
        icon: "ShoppingBag",
      },
      {
        label: "Customers",
        href: routes.admin.customers.list,
        icon: "Users",
      },
      {
        label: "Refunds",
        href: routes.admin.commerce.refunds,
        icon: "Undo2",
      },
      {
        label: "Inquiries",
        href: routes.admin.inquiries.overview,
        icon: "MessageSquare",
        children: [
          {
            label: "All",
            href: routes.admin.inquiries.overview,
            icon: "Inbox",
          },
          {
            label: "Wedding",
            href: routes.admin.inquiries.wedding,
            icon: "Heart",
          },
          {
            label: "Contact",
            href: routes.admin.inquiries.contact,
            icon: "Mail",
          },
          {
            label: "Newsletter",
            href: routes.admin.inquiries.newsletter,
            icon: "Newspaper",
          },
        ],
      },
    ],
  },
  {
    title: "Products",
    items: [
      {
        label: "Cakes",
        href: routes.admin.cakes.list,
        icon: "Cake",
      },
      {
        label: "Catalog",
        href: routes.admin.catalog,
        icon: "Tags",
      },
      {
        label: "Inventory",
        href: routes.admin.commerce.inventory,
        icon: "Package",
      },
      {
        label: "Reviews",
        href: routes.admin.commerce.reviews,
        icon: "Star",
      },
    ],
  },
  {
    title: "Store Setup",
    items: [
      {
        label: "Payments",
        href: routes.admin.commerce.payments,
        icon: "CreditCard",
      },
      {
        label: "Delivery",
        href: routes.admin.commerce.deliveryZones,
        icon: "Truck",
        children: [
          {
            label: "Zones",
            href: routes.admin.commerce.deliveryZones,
            icon: "MapPin",
          },
          {
            label: "Slots",
            href: routes.admin.commerce.deliverySlots,
            icon: "Clock",
          },
          {
            label: "Shipping Rules",
            href: routes.admin.commerce.shippingRules,
            icon: "Truck",
          },
        ],
      },
      {
        label: "Coupons",
        href: routes.admin.commerce.coupons,
        icon: "Tag",
      },
      {
        label: "Taxes",
        href: routes.admin.commerce.taxes,
        icon: "Receipt",
      },
      {
        label: "Invoices",
        href: routes.admin.commerce.invoices,
        icon: "FileText",
      },
      {
        label: "Email Templates",
        href: routes.admin.commerce.emails,
        icon: "Mail",
      },
      {
        label: "WhatsApp Templates",
        href: routes.admin.commerce.whatsapp,
        icon: "MessageCircle",
      },
    ],
  },
  {
    title: "Website",
    items: [
      {
        label: "Homepage Builder",
        href: routes.admin.builders.homepage,
        icon: "Home",
      },
      {
        label: "Wedding Builder",
        href: routes.admin.builders.wedding,
        icon: "Heart",
      },
      {
        label: "Pages",
        href: routes.admin.pages.list,
        icon: "FileText",
      },
      {
        label: "Media Library",
        href: routes.admin.media,
        icon: "FolderOpen",
      },
      {
        label: "Banners",
        href: routes.admin.banners,
        icon: "Flag",
      },
      {
        label: "Content",
        href: routes.admin.testimonials,
        icon: "Quote",
        children: [
          {
            label: "Testimonials",
            href: routes.admin.testimonials,
            icon: "Quote",
          },
          {
            label: "FAQ",
            href: routes.admin.faq,
            icon: "HelpCircle",
          },
        ],
      },
      {
        label: "Layout",
        href: routes.admin.header,
        icon: "PanelTop",
        children: [
          {
            label: "Header",
            href: routes.admin.header,
            icon: "PanelTop",
          },
          {
            label: "Footer",
            href: routes.admin.footer,
            icon: "PanelBottom",
          },
        ],
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        label: "Appearance",
        href: routes.admin.appearance,
        icon: "Palette",
      },
      {
        label: "SEO",
        href: routes.admin.seo,
        icon: "Search",
      },
      {
        label: "Settings",
        href: routes.admin.settings.overview,
        icon: "Settings",
      },
    ],
  },
];
