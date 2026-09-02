import type { Metadata } from "next";
import { getServerLabels } from "@/features/settings/server/labels.server";
import { ReviewsAdminPage } from "@/apps/admin/reviews/pages/reviews-admin-page";

export async function generateMetadata(): Promise<Metadata> {
  const { productWord, productWordPlural } = await getServerLabels();
  return {
    title: `${productWord} Reviews`,
    description: `Moderate customer reviews for ${productWordPlural.toLowerCase()} and sync storefront ratings.`,
  };
}

export default function Page() {
  return <ReviewsAdminPage />;
}
