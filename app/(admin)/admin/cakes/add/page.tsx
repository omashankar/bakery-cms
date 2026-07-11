import type { Metadata } from "next";
import { CakeFormPage } from "@/features/admin/cakes";

export const metadata: Metadata = {
  title: "Add Cake",
  description: "Create a new cake with images, SEO, and categories.",
};

export default function Page() {
  return <CakeFormPage mode="add" />;
}
