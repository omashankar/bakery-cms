import { AdminLayoutShell } from "@/layouts/admin-layout";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { getSettings } from "@/features/settings/server/settings.service";
import { redactMailPassword } from "@/features/settings/server/settings.controller";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The settings every admin screen waits for, read here so the browser does
  // not have to ask for them first — see `applyServerSettings`. Redacted
  // exactly as GET /api/settings is, and plain JSON for the client boundary.
  const initialSettings = await whenAdmin(async () =>
    JSON.parse(JSON.stringify(redactMailPassword(await getSettings()))) as Record<string, unknown>,
  );
  return <AdminLayoutShell initialSettings={initialSettings}>{children}</AdminLayoutShell>;
}
