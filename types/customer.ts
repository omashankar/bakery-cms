export type CustomerSegment = "new" | "returning" | "vip" | "at_risk" | "inactive";

export interface CustomerAdminMeta {
  email: string;
  tags: string[];
  notes: string;
  marketingOptIn: boolean;
  updatedAt: string;
}

export interface CustomerFavoriteProduct {
  slug: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface CustomerAddressSummary {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  city: string;
  state: string;
  pincode: string;
  usedCount: number;
  lastUsedAt: string;
}

export interface CustomerActivityItem {
  id: string;
  type: "order_placed" | "order_delivered" | "order_cancelled" | "note_updated";
  title: string;
  description?: string;
  at: string;
  href?: string;
}
