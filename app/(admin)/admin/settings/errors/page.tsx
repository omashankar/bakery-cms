import type { Metadata } from "next";

import { ErrorLogPage } from "@/apps/admin/settings/components/error-log-page";
import { listErrorLog } from "@/features/error-log/server/error-log.controller";
import { whenAllowed } from "@/lib/server/auth/access";

export const metadata: Metadata = {
  title: "Error log",
  description: "Problems the site ran into, on the server or in a customer's browser.",
};

/** The log, read with the page. */
export default async function Page() {
  const initial = await whenAllowed("security.view", async () => JSON.parse(JSON.stringify(await listErrorLog())));
  return <ErrorLogPage initial={initial} />;
}
