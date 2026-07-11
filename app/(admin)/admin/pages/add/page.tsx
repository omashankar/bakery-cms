import type { Metadata } from "next";
import { PageFormPage } from "@/features/admin/pages";

export const metadata: Metadata = {
  title: "Add Page",
  description: "Create a new static storefront page.",
};

export default function Page() {
  return <PageFormPage mode="add" />;
}
