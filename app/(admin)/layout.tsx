import { AdminLayoutShell } from "@/layouts/admin-layout";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { getSettings } from "@/features/settings/server/settings.service";
import { redactMailPassword } from "@/features/settings/server/settings.controller";
import { getInquiries } from "@/features/inquiries/server/inquiry.service";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The settings every admin screen waits for, read here so the browser does
  // not have to ask for them first — see `applyServerSettings`. Redacted
  // exactly as GET /api/settings is, and plain JSON for the client boundary.
  // Enquiries too: the sidebar badge and the bell read them on every screen.
  // Both reads at once — this layout's response waits on the slower of them.
  const [initialSettings, initialInquiries] = await Promise.all([
    whenAdmin(async () =>
      JSON.parse(JSON.stringify(redactMailPassword(await getSettings()))) as Record<string, unknown>,
    ),
    whenAdmin(async () => JSON.parse(JSON.stringify(await getInquiries())) as unknown[]),
  ]);
  return (
    <AdminLayoutShell initialSettings={initialSettings} initialInquiries={initialInquiries}>
      {children}
    </AdminLayoutShell>
  );
}
