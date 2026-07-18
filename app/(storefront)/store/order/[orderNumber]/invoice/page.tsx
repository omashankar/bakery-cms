import type { Metadata } from "next";
import { CustomerInvoicePage } from "@/apps/website/checkout/pages/customer-invoice-page";

export const metadata: Metadata = {
  title: "Invoice",
  description: "Download or print your order invoice.",
};

interface PageProps {
  params: Promise<{ orderNumber: string }>;
}

export default async function Page({ params }: PageProps) {
  const { orderNumber } = await params;
  return <CustomerInvoicePage orderNumber={decodeURIComponent(orderNumber)} />;
}
