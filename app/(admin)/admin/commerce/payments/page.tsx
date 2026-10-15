import type { Metadata } from "next";
import { PaymentsAdminPage } from "@/apps/admin/commerce/pages/payments-admin-page";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { readCommerceOverviews } from "@/features/orders/server/order.initial";

export const metadata: Metadata = {
  title: "Payments",
  description: "Payment methods and checkout payment options.",
};

/**
 * The payment counters, read with the page. Not the Razorpay status: that asks
 * Razorpay itself to verify the keys, and the page must not wait on a gateway.
 */
export default async function Page() {
  const initial = await whenAdmin(async () =>
    JSON.parse(JSON.stringify(await readCommerceOverviews())),
  );
  return <PaymentsAdminPage initial={initial} />;
}
