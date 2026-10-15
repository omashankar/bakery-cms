import type { Metadata } from "next";
import { getServerLabels } from "@/features/settings/server/labels.server";
import { ReviewsAdminPage } from "@/apps/admin/reviews/pages/reviews-admin-page";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { getReviews } from "@/features/reviews/server/review.service";

export async function generateMetadata(): Promise<Metadata> {
  const { productWord, productWordPlural } = await getServerLabels();
  return {
    title: `${productWord} Reviews`,
    description: `Moderate customer reviews for ${productWordPlural.toLowerCase()} and sync storefront ratings.`,
  };
}

/** Every review, read with the page; see `applyServerReviews`. */
export default async function Page() {
  const initial = await whenAdmin(async () => JSON.parse(JSON.stringify(await getReviews())));
  return <ReviewsAdminPage initial={initial} />;
}
