import type { Metadata } from "next";
import { CouponsAdminPage } from "@/apps/admin/commerce/pages/coupons-admin-page";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { getCoupons } from "@/features/commerce/server/commerce.service";

export const metadata: Metadata = {
  title: "Coupons",
  description: "Manage discount coupon codes.",
};

/** Every coupon, as staff read them, with the page. */
export default async function Page() {
  const initial = await whenAdmin(async () => JSON.parse(JSON.stringify(await getCoupons())));
  return <CouponsAdminPage initial={initial} />;
}
