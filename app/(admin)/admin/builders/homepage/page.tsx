import type { Metadata } from "next";
import { HomepageBuilderPage } from "@/features/admin/builders";

export const metadata: Metadata = {
  title: "Homepage Builder",
  description: "Drag-and-drop homepage section builder.",
};

export default function Page() {
  return <HomepageBuilderPage />;
}
