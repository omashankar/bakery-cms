import type { Metadata } from "next";
import { ProductFormPage } from "@/apps/admin/products";

export const metadata: Metadata = {
  title: "Add Cake",
  description: "Create a new cake with images, SEO, and categories.",
};

export default function Page() {
  return <ProductFormPage mode="add" />;
}
