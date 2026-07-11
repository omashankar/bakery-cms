import type { Metadata } from "next";
import { CakesListPage } from "@/features/admin/cakes";

export const metadata: Metadata = {
  title: "Cakes",
  description: "Manage all cakes with search, filters, and pagination.",
};

export default function Page() {
  return <CakesListPage />;
}
