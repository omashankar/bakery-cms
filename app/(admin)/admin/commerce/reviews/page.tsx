import type { Metadata } from "next";
import { ReviewsAdminPage } from "@/features/admin/reviews/pages/reviews-admin-page";

export const metadata: Metadata = {
  title: "Product Reviews",
  description: "Moderate customer product reviews for cakes and sync storefront ratings.",
};

export default function Page() {
  return <ReviewsAdminPage />;
}
