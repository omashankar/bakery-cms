import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WeddingBuilderPage } from "@/apps/admin/builders";
import { routes } from "@/constants/routes";
import { isWeddingEnabledOnServer } from "@/features/settings/server/modules.server";

export const metadata: Metadata = {
  title: "Wedding Builder",
  description: "Drag-and-drop wedding page builder.",
};

export default async function Page() {
  // The sidebar hides this entry when the module is off, but the route stayed
  // open — and it publishes the wedding page an admin has just turned off, so
  // the builder has to close alongside the page it builds.
  //
  // Redirect rather than `notFound()`: Next renders a not-found boundary
  // OUTSIDE this route group's layout, so an admin following a bookmark landed
  // on a bare 404 with no sidebar, no header and no way back. Settings → Modules
  // is where the switch that closed this page lives, so it both explains the
  // disappearance and is the one screen that can undo it.
  if (!(await isWeddingEnabledOnServer())) redirect(routes.admin.settings.modules);

  return <WeddingBuilderPage />;
}
