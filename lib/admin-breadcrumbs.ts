import { routes } from "@/constants/routes";

export interface AdminBreadcrumb {
  label: string;
  href?: string;
}

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  cakes: "Cakes",
  add: "Add Cake",
  edit: "Edit Cake",
  preview: "Preview",
  catalog: "Catalog",
  banners: "Banners",
  testimonials: "Testimonials",
  faq: "FAQ",
  builders: "Builders",
  homepage: "Homepage Builder",
  wedding: "Wedding",
  pages: "Pages",
  header: "Header",
  footer: "Footer",
  seo: "SEO",
  media: "Media Library",
  inquiries: "Inquiries",
  contact: "Contact",
  newsletter: "Newsletter",
  appearance: "Appearance",
  settings: "Settings",
  general: "General",
  social: "Social",
  security: "Security",
  smtp: "SMTP",
  analytics: "Analytics",
  maintenance: "Maintenance",
  backup: "Backup",
  activity: "Activity",
  permissions: "Permissions",
  commerce: "Commerce",
  orders: "Orders",
  customers: "Customers",
  reports: "Reports",
  inventory: "Inventory",
  payments: "Payments",
  "delivery-zones": "Delivery Zones",
  "delivery-slots": "Delivery Slots",
  coupons: "Coupons",
  taxes: "Taxes",
  "shipping-rules": "Shipping Rules",
  invoices: "Invoices",
  emails: "Email Templates",
  whatsapp: "WhatsApp Templates",
  notifications: "Notifications",
  refunds: "Refunds",
};

/** Segments that are path groups only — no real index page */
const NON_ROUTABLE_SEGMENTS = new Set(["commerce", "builders"]);

function isDynamicSegment(segment: string, prev?: string): boolean {
  if (!prev) return false;
  if (prev === "cakes" && !["add", "edit", "preview"].includes(segment)) {
    return true;
  }
  if (prev === "pages" && segment !== "add" && segment !== "edit") {
    return true;
  }
  if (prev === "orders" || prev === "customers") {
    return true;
  }
  return false;
}

/** Build human-readable admin breadcrumbs from pathname */
export function getAdminBreadcrumbs(pathname: string): AdminBreadcrumb[] {
  const parts = pathname.split("/").filter(Boolean);

  if (parts.length <= 1 || (parts.length === 1 && parts[0] === "admin")) {
    return [{ label: "Dashboard" }];
  }

  if (parts.length === 2 && parts[0] === "admin" && parts[1] === "dashboard") {
    return [{ label: "Dashboard" }];
  }

  const crumbs: AdminBreadcrumb[] = [
    { label: "Dashboard", href: routes.admin.dashboard },
  ];

  let href = "/admin";
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === "admin") continue;
    if (part === "dashboard") continue;

    href += `/${part}`;
    const prev = parts[i - 1];
    const next = parts[i + 1];

    if (isDynamicSegment(part, prev)) {
      if (next === "edit") {
        crumbs.push({ label: prev === "pages" ? "Edit Page" : "Edit Cake", href: `${href}/edit` });
        i += 1;
        continue;
      }
      if (next === "preview") {
        crumbs.push({ label: "Preview", href: `${href}/preview` });
        i += 1;
        continue;
      }
      crumbs.push({ label: prev === "pages" ? "Page Details" : prev === "orders" ? "Order Details" : prev === "customers" ? "Customer Details" : "Cake Details" });
      continue;
    }

    const label =
      part === "add" && prev === "pages"
        ? "Add Page"
        : part === "wedding" && prev === "builders"
          ? "Wedding Builder"
          : part === "wedding" && prev === "inquiries"
            ? "Wedding"
            : SEGMENT_LABELS[part] ??
              part.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const isLast = i === parts.length - 1;
    const routable = !NON_ROUTABLE_SEGMENTS.has(part);

    crumbs.push(isLast || !routable ? { label } : { label, href });
  }

  return crumbs;
}
