import type { Metadata } from "next";
import { CustomerDetailPage } from "@/apps/admin/commerce/pages/customer-detail-page";

export const metadata: Metadata = {
  title: "Customer Details",
  description: "View customer profile and order history.",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <CustomerDetailPage customerId={id} />;
}
