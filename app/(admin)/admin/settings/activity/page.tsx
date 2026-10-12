import type { Metadata } from "next";
import { ActivitySettingsPage } from "@/apps/admin/settings/components/activity-settings-page";
import { ACTIVITY_AUDIT_LIMIT } from "@/apps/admin/settings/lib/activity-defaults";
import { whenAdmin } from "@/lib/server/auth/admin-initial";
import { getAuditLogs } from "@/features/audit/server/audit.service";
import { auditQuerySchema } from "@/features/audit/server/audit.validators";

export const metadata: Metadata = {
  title: "Activity Log",
  description: "Recent admin actions across the CMS.",
};

/** The audit trail's newest rows, read with the page. */
export default async function Page() {
  const initial = await whenAdmin(async () => {
    const { items } = await getAuditLogs(auditQuerySchema.parse({ limit: ACTIVITY_AUDIT_LIMIT }));
    return JSON.parse(JSON.stringify(items));
  });
  return <ActivitySettingsPage initial={initial} />;
}
