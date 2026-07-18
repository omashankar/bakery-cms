import type { Metadata } from "next";
import { GatewayManagerPage } from "@/apps/admin/commerce/pages/gateway-manager-page";

export const metadata: Metadata = {
  title: "Payment Gateways",
  description: "Enable, configure and prioritise payment gateways.",
};

export default function Page() {
  return <GatewayManagerPage />;
}
