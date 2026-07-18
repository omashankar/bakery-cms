import type { Metadata } from "next";
import { TestimonialsAdminPage } from "@/apps/admin/testimonials";

export const metadata: Metadata = {
  title: "Testimonials",
  description: "Manage customer reviews and ratings.",
};

export default function Page() {
  return <TestimonialsAdminPage />;
}
