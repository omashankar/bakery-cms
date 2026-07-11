import type { Metadata } from "next";
import { OrderDetailPage } from "@/features/storefront/checkout/pages/order-detail-page";

export const metadata: Metadata = {
  title: "Order Details",
  description: "View your order status and delivery timeline.",
};

export default function Page() {
  return <OrderDetailPage />;
}
