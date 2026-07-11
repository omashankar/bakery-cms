import type { Metadata } from "next";
import { AccountRegisterPage } from "@/features/storefront/account/pages/account-register-page";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Create a bakery account for faster checkout and order tracking.",
};

export default function Page() {
  return <AccountRegisterPage />;
}
