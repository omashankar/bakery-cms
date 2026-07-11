import type { Metadata } from "next";
import { AuthSessionExpiredPage } from "@/features/auth";

export const metadata: Metadata = {
  title: "Session Expired",
  description: "Session timeout notification screen.",
};

export default function Page() {
  return <AuthSessionExpiredPage />;
}
