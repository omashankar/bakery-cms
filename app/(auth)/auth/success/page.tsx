import type { Metadata } from "next";
import { AuthSuccessPage } from "@/features/auth";

export const metadata: Metadata = {
  title: "Success",
  description: "Auth action success confirmation.",
};

export default function Page() {
  return <AuthSuccessPage />;
}
