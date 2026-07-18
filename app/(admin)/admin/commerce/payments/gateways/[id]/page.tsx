import type { Metadata } from "next";
import { GatewayConfigPage } from "@/apps/admin/commerce/pages/gateway-config-page";

export const metadata: Metadata = {
  title: "Gateway Settings",
  description: "Configure a payment gateway.",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <GatewayConfigPage gatewayId={id} />;
}
