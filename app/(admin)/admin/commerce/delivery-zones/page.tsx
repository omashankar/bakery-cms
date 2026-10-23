import type { Metadata } from "next";
import { DeliveryZonesAdminPage } from "@/apps/admin/commerce/pages/delivery-zones-admin-page";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { getZones } from "@/features/commerce/server/commerce.service";
import { describeDirectory } from "@/features/commerce/server/pincode-directory";

export const metadata: Metadata = {
  title: "Delivery Zones",
  description: "Delivery zones by PIN code, district, state or all of India.",
};

/** Every delivery zone, as staff read them, with the page — and how fresh the PIN list is. */
export default async function Page() {
  const initial = await whenAdmin(async () => JSON.parse(JSON.stringify(await getZones())));
  const { updated, pins } = describeDirectory();
  return <DeliveryZonesAdminPage initial={initial} pinDirectory={{ updated, pins }} />;
}
