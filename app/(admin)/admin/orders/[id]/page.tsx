import type { Metadata } from "next";
import { OrderDetailPage } from "@/apps/admin/commerce/pages/order-detail-page";

export const metadata: Metadata = {
  title: "Order Details",
  description: "View and update a customer order.",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <OrderDetailPage orderId={id} />;
}
