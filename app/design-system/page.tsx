import type { Metadata } from "next";
import { DesignSystemPage } from "@/features/design-system/design-system-page";

export const metadata: Metadata = {
  title: "Design System",
  description: "Bakery CMS design tokens, components, and UI foundations.",
};

export default function Page() {
  return <DesignSystemPage />;
}
