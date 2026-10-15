import type { Metadata } from "next";
import { CustomCodeSettingsPage } from "@/apps/admin/settings/components/custom-code-settings-page";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { readAdminConfigForAdmin } from "@/features/admin-config/server/admin-config.initial";

export const metadata: Metadata = {
  title: "Custom Code",
  description: "Inject custom CSS and JavaScript into the storefront.",
};

/** The shop's custom code, read with the page — with the rest of its gate. */
export default async function Page() {
  const initial = await whenAdmin(async () =>
    JSON.parse(JSON.stringify(await readAdminConfigForAdmin())),
  );
  return <CustomCodeSettingsPage initial={initial} />;
}
