import type { Metadata } from "next";
import { CustomCodeSettingsPage } from "@/apps/admin/settings/components/custom-code-settings-page";
import { whenAllowed } from "@/lib/server/auth/access";
import { readAdminConfigForAdmin } from "@/features/admin-config/server/admin-config.initial";

export const metadata: Metadata = {
  title: "Custom Code",
  description: "Inject custom CSS and JavaScript into the storefront.",
};

/** The shop's custom code, read with the page — with the rest of its gate. */
export default async function Page() {
  const initial = await whenAllowed("settings.view", async (actor) =>
    JSON.parse(JSON.stringify(await readAdminConfigForAdmin(actor))),
  );
  return <CustomCodeSettingsPage initial={initial} />;
}
