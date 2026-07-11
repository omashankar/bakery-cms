"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { getMaintenanceSettings } from "@/features/admin/settings";

export function MaintenanceBanner() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const maintenance = getMaintenanceSettings();
    setMessage(maintenance.isEnabled ? maintenance.message : null);
  }, []);

  if (!message) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
      <div className="mx-auto flex max-w-6xl items-start gap-3 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <p>{message}</p>
      </div>
    </div>
  );
}
