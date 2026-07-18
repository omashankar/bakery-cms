import type { Metadata } from "next";
import { DeliveryZonesAdminPage } from "@/apps/admin/commerce/pages/delivery-zones-admin-page";

export const metadata: Metadata = {
  title: "Delivery Zones",
  description: "City, pincode, and radius-based delivery zones.",
};

export default function Page() {
  return <DeliveryZonesAdminPage />;
}
