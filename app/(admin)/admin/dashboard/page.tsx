import type { Metadata } from "next";
import { DashboardPage } from "@/apps/admin/dashboard";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Statistics, charts, recent activity, and quick actions.",
};

export default function Page() {
  return <DashboardPage />;
}
