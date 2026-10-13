import type { Metadata } from "next";
import { CancellationsAdminPage } from "@/apps/admin/commerce/pages/cancellations-admin-page";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { listCancellationCases } from "@/features/orders/server/cancellation.service";

export const metadata: Metadata = {
  title: "Cancellations",
  description: "Customer cancellation requests and reported problems.",
};

/** Every case, read with the page — the list is what this screen is for. */
export default async function Page() {
  const initial = await whenAdmin(async () =>
    JSON.parse(JSON.stringify(await listCancellationCases())),
  );
  return <CancellationsAdminPage initial={initial} />;
}
