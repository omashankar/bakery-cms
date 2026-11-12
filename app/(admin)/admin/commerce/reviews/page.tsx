import type { Metadata } from "next";
import { getServerLabels } from "@/features/settings/server/labels.server";
import { ReviewsAdminPage } from "@/apps/admin/reviews/pages/reviews-admin-page";
import { whenAllowed } from "@/lib/server/auth/access";
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
  const initial = await whenAllowed("reviews.manage", async () => JSON.parse(JSON.stringify(await getReviews())));
  return <ReviewsAdminPage initial={initial} />;
}
