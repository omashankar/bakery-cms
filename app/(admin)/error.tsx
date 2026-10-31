"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { reportClientError } from "@/features/error-log/lib/report-client-error";

/**
 * An admin screen that crashed, inside the admin's own frame.
 *
 * There was no boundary under `app/(admin)`: one screen throwing replaced the
 * whole admin — sidebar included — with Next's bare error page, and the owner
 * had no way back but the address bar. Now the sidebar stays, the screen says
 * so plainly, and the failure is recorded in Settings → Error log.
 */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  useEffect(() => reportClientError(error), [error]);

  // `reset` alone re-renders the result that already threw; refetch first.
  function retry() {
    router.refresh();
    reset();
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-5" aria-hidden />
      </span>
      <h1 className="text-lg font-semibold text-foreground">This screen ran into a problem</h1>
      <p className="text-sm text-muted-foreground">
        Nothing was lost. Try again, or open another screen from the menu. It has been noted in
        Settings → Error log.
      </p>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        <Button onClick={retry}>Try again</Button>
        <Button variant="outline" render={<Link href={routes.admin.dashboard} />} nativeButton={false}>
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}
