import type { Metadata } from "next";
import { ReportsPage } from "@/apps/admin/reports";

export const metadata: Metadata = {
  title: "Reports",
  description: "Revenue, orders, products, and customer analytics.",
};

export default function Page() {
  return <ReportsPage />;
}
