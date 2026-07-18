import type { Metadata } from "next";
import { ShippingRulesAdminPage } from "@/apps/admin/commerce/pages/shipping-rules-admin-page";

export const metadata: Metadata = {
  title: "Shipping Rules",
  description: "Delivery fees, free delivery thresholds, and zone-based pricing.",
};

export default function Page() {
  return <ShippingRulesAdminPage />;
}
