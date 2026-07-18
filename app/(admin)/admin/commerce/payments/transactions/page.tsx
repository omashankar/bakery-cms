import type { Metadata } from "next";
import { TransactionsPage } from "@/apps/admin/commerce/pages/transactions-page";

export const metadata: Metadata = {
  title: "Transactions",
  description: "All payment transactions across gateways.",
};

export default function Page() {
  return <TransactionsPage />;
}
