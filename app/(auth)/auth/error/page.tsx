import type { Metadata } from "next";
import { AuthErrorPage } from "@/features/auth";

export const metadata: Metadata = {
  title: "Error",
  description: "Authentication error screen.",
};

export default function Page() {
  return <AuthErrorPage />;
}
