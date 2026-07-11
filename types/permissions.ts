/** Placeholder types for future role-based access control */

export type PermissionScope =
  | "dashboard"
  | "orders"
  | "customers"
  | "products"
  | "content"
  | "builders"
  | "media"
  | "settings"
  | "reports";

export interface PermissionDefinition {
  id: string;
  label: string;
  description: string;
}

export interface RoleDefinition {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  memberCount: number;
  permissions: PermissionScope[];
}

export const permissionDefinitions: PermissionDefinition[] = [
  { id: "dashboard", label: "Dashboard", description: "View analytics and KPIs" },
  { id: "orders", label: "Orders", description: "Manage orders and fulfillment" },
  { id: "customers", label: "Customers", description: "View and edit customer profiles" },
  { id: "products", label: "Products", description: "Manage cakes, catalog, and inventory" },
  { id: "content", label: "Content", description: "Pages, banners, testimonials, FAQ" },
  { id: "builders", label: "Builders", description: "Homepage and wedding page builders" },
  { id: "media", label: "Media", description: "Upload and organize media library" },
  { id: "settings", label: "Settings", description: "Site and system configuration" },
  { id: "reports", label: "Reports", description: "Commerce reports and exports" },
];

export const placeholderRoles: RoleDefinition[] = [
  {
    id: "role-owner",
    name: "Owner",
    description: "Full access to commerce, CMS, and system settings.",
    isSystem: true,
    memberCount: 1,
    permissions: permissionDefinitions.map((p) => p.id as PermissionScope),
  },
  {
    id: "role-manager",
    name: "Store Manager",
    description: "Orders, customers, products, and daily operations.",
    isSystem: false,
    memberCount: 0,
    permissions: ["dashboard", "orders", "customers", "products", "reports"],
  },
  {
    id: "role-editor",
    name: "Content Editor",
    description: "Website content, builders, and media only.",
    isSystem: false,
    memberCount: 0,
    permissions: ["dashboard", "content", "builders", "media"],
  },
  {
    id: "role-viewer",
    name: "Viewer",
    description: "Read-only access to dashboard and reports.",
    isSystem: false,
    memberCount: 0,
    permissions: ["dashboard", "reports"],
  },
];
