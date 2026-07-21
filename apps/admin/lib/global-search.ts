import { adminNavSections } from "@/constants/navigation";
import { routes } from "@/constants/routes";
import { isWeddingEnabled } from "@/features/settings/lib/settings-repository";
import { loadProducts } from "@/features/products/lib/products-repository";
import { loadCoupons } from "@/features/commerce/lib/coupons-repository";
import {
  getCustomerProfiles,
  formatCustomerSegmentLabel,
} from "@/apps/admin/commerce/lib/customer-profile-utils";
import { loadDeliveryZones } from "@/features/commerce/lib/delivery-zones-repository";
import { getInventoryItems } from "@/apps/admin/commerce/lib/inventory-repository";
import { formatStockStatusLabel } from "@/apps/admin/commerce/lib/inventory-utils";
import { loadInquiries } from "@/features/inquiries/lib/inquiries-repository";
import { formatInquiryStatus } from "@/features/inquiries/lib/inquiry-utils";
import { loadMediaFiles } from "@/apps/admin/media/lib/media-repository";
import { loadPages } from "@/features/content/lib/pages-repository";
import { formatOrderStatus } from "@/features/orders/lib/order-status-meta";
import { getOrders } from "@/features/orders/lib/orders";

export type GlobalSearchGroup =
  | "products"
  | "orders"
  | "customers"
  | "coupons"
  | "pages"
  | "media"
  | "inquiries"
  | "inventory"
  | "delivery"
  | "settings"
  | "navigation"
  | "actions";

export interface GlobalSearchResult {
  id: string;
  group: GlobalSearchGroup;
  title: string;
  subtitle?: string;
  href: string;
  badge?: string;
  keywords?: string[];
}

export interface GlobalSearchOptions {
  limitPerGroup?: number;
  groupFilter?: GlobalSearchGroup | "all";
}

const GROUP_LABELS: Record<GlobalSearchGroup, string> = {
  products: "Products",
  orders: "Orders",
  customers: "Customers",
  coupons: "Coupons",
  pages: "Pages",
  media: "Media",
  inquiries: "Inquiries",
  inventory: "Inventory",
  delivery: "Delivery Zones",
  settings: "Settings",
  navigation: "Pages & Modules",
  actions: "Quick Actions",
};

const PREFIX_GROUPS: Record<string, GlobalSearchGroup> = {
  product: "products",
  products: "products",
  cake: "products",
  cakes: "products",
  order: "orders",
  orders: "orders",
  customer: "customers",
  customers: "customers",
  coupon: "coupons",
  coupons: "coupons",
  page: "pages",
  pages: "pages",
  media: "media",
  inquiry: "inquiries",
  inquiries: "inquiries",
  stock: "inventory",
  inventory: "inventory",
  zone: "delivery",
  zones: "delivery",
  delivery: "delivery",
  setting: "settings",
  settings: "settings",
  nav: "navigation",
  goto: "navigation",
  action: "actions",
  actions: "actions",
};

const SETTINGS_ENTRIES: GlobalSearchResult[] = [
  {
    id: "settings-commerce",
    group: "settings",
    title: "Commerce Settings",
    subtitle: "Delivery, payments, checkout",
    href: routes.admin.settings.commerce,
    keywords: ["shipping", "checkout", "payments"],
  },
  {
    id: "settings-general",
    group: "settings",
    title: "General Settings",
    subtitle: "Site name, branding, business type",
    href: routes.admin.settings.general,
    keywords: ["business type", "brand", "logo", "currency"],
  },
  {
    id: "settings-modules",
    group: "settings",
    title: "Modules",
    subtitle: "Optional features & wedding builder",
    href: routes.admin.settings.modules,
    keywords: ["flavour", "weight", "shape", "egg", "eggless", "photo cake", "wedding"],
  },
  {
    id: "settings-contact",
    group: "settings",
    title: "Contact Settings",
    subtitle: "Phone, email, address",
    href: routes.admin.settings.contact,
  },
  {
    id: "settings-security",
    group: "settings",
    title: "Security",
    subtitle: "Sessions and access",
    href: routes.admin.settings.security,
  },
  {
    id: "settings-permissions",
    group: "settings",
    title: "Roles & Permissions",
    subtitle: "Future team access control",
    href: routes.admin.settings.permissions,
  },
  {
    id: "settings-backup",
    group: "settings",
    title: "Backup & Restore",
    subtitle: "Export and import data",
    href: routes.admin.settings.backup,
  },
  {
    id: "settings-smtp",
    group: "settings",
    title: "SMTP",
    subtitle: "Email delivery",
    href: routes.admin.settings.smtp,
  },
  {
    id: "settings-appearance",
    group: "settings",
    title: "Appearance",
    subtitle: "Theme and storefront styling",
    href: routes.admin.appearance,
  },
  {
    id: "settings-seo",
    group: "settings",
    title: "SEO Settings",
    subtitle: "Meta defaults and sitemap",
    href: routes.admin.seo,
  },
  {
    id: "settings-activity",
    group: "settings",
    title: "Activity Log",
    subtitle: "Admin audit trail",
    href: routes.admin.settings.activity,
  },
  {
    id: "commerce-taxes",
    group: "settings",
    title: "Taxes",
    subtitle: "GST and platform charges",
    href: routes.admin.commerce.taxes,
    keywords: ["gst", "tax"],
  },
  {
    id: "commerce-payments",
    group: "settings",
    title: "Payments",
    subtitle: "COD, UPI, and card methods",
    href: routes.admin.commerce.payments,
    keywords: ["checkout", "cod", "upi", "card"],
  },
  {
    id: "commerce-delivery-slots",
    group: "settings",
    title: "Delivery Slots",
    subtitle: "Time windows and lead days",
    href: routes.admin.commerce.deliverySlots,
    keywords: ["schedule", "slot", "delivery time"],
  },
  {
    id: "commerce-shipping",
    group: "settings",
    title: "Shipping Rules",
    subtitle: "Delivery fees and thresholds",
    href: routes.admin.commerce.shippingRules,
  },
  {
    id: "commerce-notifications",
    group: "settings",
    title: "Notifications",
    subtitle: "Order and stock alerts",
    href: routes.admin.commerce.notifications,
  },
  {
    id: "commerce-emails",
    group: "settings",
    title: "Email Templates",
    subtitle: "Transactional and marketing emails",
    href: routes.admin.commerce.emails,
    keywords: ["smtp", "mail", "template"],
  },
  {
    id: "commerce-whatsapp",
    group: "settings",
    title: "WhatsApp Templates",
    subtitle: "Business message templates",
    href: routes.admin.commerce.whatsapp,
    keywords: ["sms", "message", "template"],
  },
  {
    id: "commerce-invoices",
    group: "settings",
    title: "Invoices",
    subtitle: "Print invoices and customize design",
    href: routes.admin.commerce.invoices,
    keywords: ["gst", "print", "billing", "invoice", "designer"],
  },
  {
    id: "commerce-refunds",
    group: "settings",
    title: "Refund Center",
    subtitle: "Cancellations and refund tracking",
    href: routes.admin.commerce.refunds,
    keywords: ["cancel", "return", "money"],
  },
];

const ACTION_ENTRIES: GlobalSearchResult[] = [
  {
    id: "action-add-cake",
    group: "actions",
    title: "Add new cake",
    subtitle: "Create a product",
    href: routes.admin.cakes.add,
    keywords: ["create", "product", "new"],
  },
  {
    id: "action-add-page",
    group: "actions",
    title: "Add new page",
    subtitle: "CMS content page",
    href: routes.admin.pages.add,
    keywords: ["create", "content"],
  },
  {
    id: "action-upload-media",
    group: "actions",
    title: "Open media library",
    subtitle: "Upload images",
    href: routes.admin.media,
    keywords: ["upload", "image", "asset"],
  },
  {
    id: "action-coupons",
    group: "actions",
    title: "Manage coupons",
    subtitle: "Discount codes",
    href: routes.admin.commerce.coupons,
    keywords: ["discount", "promo"],
  },
  {
    id: "action-inventory",
    group: "actions",
    title: "Adjust inventory",
    subtitle: "Stock levels",
    href: routes.admin.commerce.inventory,
    keywords: ["stock", "quantity"],
  },
  {
    id: "action-delivery-zones",
    group: "actions",
    title: "Manage delivery zones",
    subtitle: "Pincode and city pricing",
    href: routes.admin.commerce.deliveryZones,
    keywords: ["shipping", "zone"],
  },
  {
    id: "action-reports",
    group: "actions",
    title: "View reports",
    subtitle: "Sales and performance",
    href: routes.admin.reports,
    keywords: ["analytics", "revenue"],
  },
  {
    id: "action-storefront",
    group: "actions",
    title: "View storefront",
    subtitle: "Customer website",
    href: routes.store.home,
    keywords: ["website", "preview"],
  },
];

function buildNavigationEntries(): GlobalSearchResult[] {
  const entries: GlobalSearchResult[] = [];

  for (const section of adminNavSections) {
    for (const item of section.items) {
      entries.push({
        id: `nav-${item.href}`,
        group: "navigation",
        title: item.label,
        subtitle: section.title,
        href: item.href,
        keywords: [section.title.toLowerCase(), item.label.toLowerCase()],
      });

      for (const child of item.children ?? []) {
        entries.push({
          id: `nav-${child.href}`,
          group: "navigation",
          title: child.label,
          subtitle: `${section.title} · ${item.label}`,
          href: child.href,
          keywords: [child.label.toLowerCase(), item.label.toLowerCase()],
        });
      }
    }
  }

  return entries;
}

const NAVIGATION_ENTRIES = buildNavigationEntries();

export function getGlobalSearchGroupLabel(group: GlobalSearchGroup): string {
  return GROUP_LABELS[group];
}

export function getGlobalSearchGroupHints(): Array<{ prefix: string; label: string }> {
  return [
    { prefix: "order:", label: "Orders" },
    { prefix: "product:", label: "Products" },
    { prefix: "customer:", label: "Customers" },
    { prefix: "inquiry:", label: "Inquiries" },
    { prefix: "stock:", label: "Inventory" },
    { prefix: "zone:", label: "Delivery" },
    { prefix: ">", label: "Actions" },
  ];
}

export function parseGlobalSearchQuery(raw: string): {
  text: string;
  groupFilter: GlobalSearchGroup | "all";
} {
  const trimmed = raw.trim();
  if (!trimmed) return { text: "", groupFilter: "all" };

  if (trimmed.startsWith(">")) {
    return { text: trimmed.slice(1).trim(), groupFilter: "actions" };
  }

  const colonIndex = trimmed.indexOf(":");
  if (colonIndex > 0 && colonIndex < 24) {
    const prefix = trimmed.slice(0, colonIndex).toLowerCase();
    const mapped = PREFIX_GROUPS[prefix];
    if (mapped) {
      return { text: trimmed.slice(colonIndex + 1).trim(), groupFilter: mapped };
    }
  }

  return { text: trimmed, groupFilter: "all" };
}

function matchesQuery(entry: Pick<GlobalSearchResult, "title" | "subtitle" | "keywords">, query: string): boolean {
  const haystack = [entry.title, entry.subtitle ?? "", ...(entry.keywords ?? [])]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function shouldSearchGroup(group: GlobalSearchGroup, filter: GlobalSearchGroup | "all"): boolean {
  return filter === "all" || filter === group;
}

function searchProducts(text: string, limit: number): GlobalSearchResult[] {
  return loadProducts()
    .filter((cake) => matchesQuery({ title: cake.name, subtitle: cake.slug }, text))
    .slice(0, limit)
    .map((cake) => ({
      id: `cake-${cake.id}`,
      group: "products" as const,
      title: cake.name,
      subtitle: cake.slug,
      href: routes.admin.cakes.edit(cake.id),
      badge: cake.status === "published" ? "Published" : cake.status === "draft" ? "Draft" : "Archived",
    }));
}

function searchOrders(text: string, limit: number): GlobalSearchResult[] {
  return getOrders()
    .filter((order) =>
      matchesQuery(
        {
          title: order.orderNumber,
          subtitle: `${order.address.fullName} ${order.address.email}`,
        },
        text
      )
    )
    .slice(0, limit)
    .map((order) => ({
      id: `order-${order.id}`,
      group: "orders" as const,
      title: order.orderNumber,
      subtitle: order.address.fullName,
      href: routes.admin.orders.detail(order.id),
      badge: formatOrderStatus(order.status),
    }));
}

function searchCustomers(text: string, limit: number): GlobalSearchResult[] {
  return getCustomerProfiles()
    .filter((customer) =>
      matchesQuery(
        {
          title: customer.name,
          subtitle: customer.email,
          keywords: [customer.phone, customer.segment, ...customer.meta.tags],
        },
        text
      )
    )
    .slice(0, limit)
    .map((customer) => ({
      id: `customer-${customer.id}`,
      group: "customers" as const,
      title: customer.name,
      subtitle: customer.email,
      href: routes.admin.customers.detail(customer.id),
      badge: formatCustomerSegmentLabel(customer.segment),
    }));
}

function searchCoupons(text: string, limit: number): GlobalSearchResult[] {
  return loadCoupons()
    .filter((coupon) => matchesQuery({ title: coupon.code, subtitle: coupon.label }, text))
    .slice(0, limit)
    .map((coupon) => ({
      id: `coupon-${coupon.id}`,
      group: "coupons" as const,
      title: coupon.code,
      subtitle: coupon.label,
      href: routes.admin.commerce.coupons,
      badge: coupon.isActive ? "Active" : "Inactive",
    }));
}

function searchPages(text: string, limit: number): GlobalSearchResult[] {
  return loadPages()
    .filter((page) => matchesQuery({ title: page.title, subtitle: page.slug }, text))
    .slice(0, limit)
    .map((page) => ({
      id: `page-${page.id}`,
      group: "pages" as const,
      title: page.title,
      subtitle: `/${page.slug}`,
      href: routes.admin.pages.edit(page.id),
      badge: page.status === "published" ? "Published" : "Draft",
    }));
}

function searchMedia(text: string, limit: number): GlobalSearchResult[] {
  return loadMediaFiles()
    .filter((file) => matchesQuery({ title: file.name, subtitle: file.alt ?? "" }, text))
    .slice(0, limit)
    .map((file) => ({
      id: `media-${file.id}`,
      group: "media" as const,
      title: file.name,
      subtitle: file.alt,
      href: routes.admin.media,
    }));
}

function searchInquiries(text: string, limit: number): GlobalSearchResult[] {
  return loadInquiries()
    .filter((inquiry) =>
      matchesQuery(
        {
          title: inquiry.name,
          subtitle: `${inquiry.email} ${inquiry.subject ?? ""} ${inquiry.message}`,
        },
        text
      )
    )
    .slice(0, limit)
    .map((inquiry) => ({
      id: `inquiry-${inquiry.id}`,
      group: "inquiries" as const,
      title: inquiry.subject ? `${inquiry.name} · ${inquiry.subject}` : inquiry.name,
      subtitle: inquiry.email,
      href:
        inquiry.type === "wedding"
          ? routes.admin.inquiries.wedding
          : inquiry.type === "newsletter"
            ? routes.admin.inquiries.newsletter
            : routes.admin.inquiries.contact,
      badge: formatInquiryStatus(inquiry.status),
    }));
}

function searchInventory(text: string, limit: number): GlobalSearchResult[] {
  return getInventoryItems()
    .filter((item) => matchesQuery({ title: item.name, subtitle: `${item.slug} ${item.categoryName}` }, text))
    .slice(0, limit)
    .map((item) => ({
      id: `inventory-${item.cakeId}`,
      group: "inventory" as const,
      title: item.name,
      subtitle: item.unlimitedStock ? "Unlimited stock" : `${item.stockQuantity} in stock`,
      href: routes.admin.commerce.inventory,
      badge: formatStockStatusLabel(item.stockStatus),
    }));
}

function searchDeliveryZones(text: string, limit: number): GlobalSearchResult[] {
  return loadDeliveryZones()
    .filter((zone) =>
      matchesQuery(
        {
          title: zone.name,
          subtitle: `${zone.city} ${zone.pincode}`,
        },
        text
      )
    )
    .slice(0, limit)
    .map((zone) => ({
      id: `zone-${zone.id}`,
      group: "delivery" as const,
      title: zone.name,
      subtitle: `${zone.city} · ${zone.pincode}`,
      href: routes.admin.commerce.deliveryZones,
      badge: zone.isActive ? "Active" : "Inactive",
    }));
}

function searchSettings(text: string, limit: number): GlobalSearchResult[] {
  return SETTINGS_ENTRIES.filter((entry) => matchesQuery(entry, text)).slice(0, limit);
}

function searchNavigation(text: string, limit: number): GlobalSearchResult[] {
  // Don't surface the Wedding Builder in search when it's hidden from the sidebar.
  const weddingOn = isWeddingEnabled();
  return NAVIGATION_ENTRIES.filter(
    (entry) =>
      (weddingOn || entry.href !== routes.admin.builders.wedding) && matchesQuery(entry, text)
  ).slice(0, limit);
}

function searchActions(text: string, limit: number): GlobalSearchResult[] {
  return ACTION_ENTRIES.filter((entry) => matchesQuery(entry, text)).slice(0, limit);
}

/** Client-side admin global search across catalog, commerce, CMS, and settings */
export function searchAdminGlobal(
  query: string,
  options: GlobalSearchOptions = {}
): GlobalSearchResult[] {
  const limitPerGroup = options.limitPerGroup ?? 5;
  const parsed = parseGlobalSearchQuery(query);
  const groupFilter = options.groupFilter ?? parsed.groupFilter;
  const text = parsed.text.trim();

  if (!text) return [];

  const results: GlobalSearchResult[] = [];

  if (shouldSearchGroup("products", groupFilter)) {
    results.push(...searchProducts(text, limitPerGroup));
  }
  if (shouldSearchGroup("orders", groupFilter)) {
    results.push(...searchOrders(text, limitPerGroup));
  }
  if (shouldSearchGroup("customers", groupFilter)) {
    results.push(...searchCustomers(text, limitPerGroup));
  }
  if (shouldSearchGroup("coupons", groupFilter)) {
    results.push(...searchCoupons(text, limitPerGroup));
  }
  if (shouldSearchGroup("pages", groupFilter)) {
    results.push(...searchPages(text, limitPerGroup));
  }
  if (shouldSearchGroup("media", groupFilter)) {
    results.push(...searchMedia(text, limitPerGroup));
  }
  if (shouldSearchGroup("inquiries", groupFilter)) {
    results.push(...searchInquiries(text, limitPerGroup));
  }
  if (shouldSearchGroup("inventory", groupFilter)) {
    results.push(...searchInventory(text, limitPerGroup));
  }
  if (shouldSearchGroup("delivery", groupFilter)) {
    results.push(...searchDeliveryZones(text, limitPerGroup));
  }
  if (shouldSearchGroup("settings", groupFilter)) {
    results.push(...searchSettings(text, limitPerGroup));
  }
  if (shouldSearchGroup("navigation", groupFilter)) {
    results.push(...searchNavigation(text, limitPerGroup));
  }
  if (shouldSearchGroup("actions", groupFilter)) {
    results.push(...searchActions(text, limitPerGroup));
  }

  return results;
}

export function getGlobalSearchShortcuts(): GlobalSearchResult[] {
  const popularHrefs = new Set<string>([
    routes.admin.dashboard,
    routes.admin.orders.list,
    routes.admin.cakes.list,
    routes.admin.commerce.inventory,
    routes.admin.commerce.notifications,
    routes.admin.reports,
  ]);

  return [
    ...ACTION_ENTRIES.slice(0, 4),
    ...NAVIGATION_ENTRIES.filter((entry) => popularHrefs.has(entry.href)),
  ];
}

export function groupGlobalSearchResults(
  results: GlobalSearchResult[]
): Array<{ group: GlobalSearchGroup; label: string; items: GlobalSearchResult[] }> {
  const order: GlobalSearchGroup[] = [
    "actions",
    "navigation",
    "products",
    "orders",
    "customers",
    "inquiries",
    "inventory",
    "delivery",
    "coupons",
    "pages",
    "media",
    "settings",
  ];

  return order
    .map((group) => ({
      group,
      label: GROUP_LABELS[group],
      items: results.filter((item) => item.group === group),
    }))
    .filter((section) => section.items.length > 0);
}
