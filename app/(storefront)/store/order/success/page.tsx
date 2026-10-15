import type { Metadata } from "next";
import { OrderSuccessPage } from "@/apps/website/checkout/pages/order-success-page";

export const metadata: Metadata = {
  title: "Order Confirmed",
  description: "Your order has been placed successfully.",
};

interface PageProps {
  searchParams: Promise<{ order?: string | string[] }>;
}

/** The order number from the link, so the confirmation is in the HTML. */
export default async function Page({ searchParams }: PageProps) {
  const { order } = await searchParams;
  const orderNumber = (Array.isArray(order) ? order[0] : order)?.trim() || null;
  return <OrderSuccessPage orderNumber={orderNumber} />;
}
