import type { Metadata } from "next";
import { DeliveryZonesAdminPage } from "@/apps/admin/commerce/pages/delivery-zones-admin-page";
import { whenAllowed } from "@/lib/server/auth/access";
import { getZones } from "@/features/commerce/server/commerce.service";

export const metadata: Metadata = {
  title: "Delivery Zones",
  description: "Delivery areas drawn on the map: a circle round the shop, or a boundary.",
};

/** Every delivery zone, as staff read them, with the page. */
export default async function Page() {
  const initial = await whenAllowed("settings.view", async () => JSON.parse(JSON.stringify(await getZones())));
  return <DeliveryZonesAdminPage initial={initial} />;
}
