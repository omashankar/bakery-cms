import type { Metadata } from "next";
import { TrackOrderPage } from "@/apps/website/checkout/pages/track-order-page";

export const metadata: Metadata = {
  title: "Track Order",
  description: "Track your bakery order delivery status.",
};

export default function Page() {
  return <TrackOrderPage />;
}
