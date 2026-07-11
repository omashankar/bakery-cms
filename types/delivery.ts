import type { BaseEntity } from "./common";

export interface DeliveryZone extends BaseEntity {
  name: string;
  city: string;
  pincode: string;
  radiusKm: number;
  deliveryCharge: number;
  minDeliveryDays: number;
  estimatedDeliveryDays: number;
  isActive: boolean;
  priority: number;
}

export type DeliveryZoneFormData = Omit<DeliveryZone, "id" | "createdAt" | "updatedAt">;

export interface DeliveryZoneMatch {
  zone: DeliveryZone;
  matchType: "pincode" | "city";
}

export type DeliveryZoneStatusFilter = "all" | "active" | "inactive";

export interface DeliveryZoneListFilters {
  search: string;
  status: DeliveryZoneStatusFilter;
  city: string;
}

export const defaultDeliveryZoneFilters: DeliveryZoneListFilters = {
  search: "",
  status: "all",
  city: "all",
};
