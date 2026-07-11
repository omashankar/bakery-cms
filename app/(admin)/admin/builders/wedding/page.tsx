import type { Metadata } from "next";
import { WeddingBuilderPage } from "@/features/admin/builders";

export const metadata: Metadata = {
  title: "Wedding Builder",
  description: "Drag-and-drop wedding page builder.",
};

export default function Page() {
  return <WeddingBuilderPage />;
}
