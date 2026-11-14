import { AdminLayoutShell } from "@/layouts/admin-layout";
import { getActor, toAccessSnapshot, whenAllowed, whenStaff } from "@/lib/server/auth/access";
import { getSettings } from "@/features/settings/server/settings.service";
import { settingsForActor } from "@/features/settings/server/settings.controller";
import { getInquiries } from "@/features/inquiries/server/inquiry.service";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The settings every admin screen waits for, read here so the browser does
  // not have to ask for them first — see `applyServerSettings`. Redacted
  // exactly as GET /api/settings is for this member, and plain JSON for the
  // client boundary. Enquiries too: the sidebar badge and the bell read them on
  // every screen — but only for someone who may read enquiries.
  //
  // And WHO this is and what they may do, so the sidebar, the route guard and
  // every action button render right on the first paint. Read once per
  // request (`getActor` is memoised); the API checks it again on every call.
  const [actor, initialSettings, initialInquiries] = await Promise.all([
    getActor().catch(() => null),
    whenStaff(async (actor) =>
      JSON.parse(JSON.stringify(settingsForActor(await getSettings(), actor))) as Record<string, unknown>,
    ),
    whenAllowed("inquiries.view", async () =>
      JSON.parse(JSON.stringify(await getInquiries())) as unknown[],
    ),
  ]);
  return (
    <AdminLayoutShell
      access={actor ? toAccessSnapshot(actor) : null}
      initialSettings={initialSettings}
      initialInquiries={initialInquiries}
    >
      {children}
    </AdminLayoutShell>
  );
}
