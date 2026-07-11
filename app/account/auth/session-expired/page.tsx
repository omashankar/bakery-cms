import type { Metadata } from "next";
import { AccountSessionExpiredPage } from "@/features/storefront/account/pages/account-session-expired-page";

export const metadata: Metadata = {
  title: "Session Expired",
  description: "Your session has expired. Please sign in again.",
};

export default function Page() {
  return <AccountSessionExpiredPage />;
}
