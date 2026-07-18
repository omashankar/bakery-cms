import type { Metadata } from "next";
import { DeliverySlotsAdminPage } from "@/apps/admin/commerce/pages/delivery-slots-admin-page";

export const metadata: Metadata = {
  title: "Delivery Slots",
  description: "Checkout delivery time slots and lead times.",
};

export default function Page() {
  return <DeliverySlotsAdminPage />;
}
