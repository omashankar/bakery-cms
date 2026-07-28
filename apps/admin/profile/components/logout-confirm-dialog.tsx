"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { clearDemoSession } from "@/features/auth/lib/session";
import { logoutRequest } from "@/features/auth/lib/auth-api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { routes } from "@/constants/routes";

interface LogoutConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LogoutConfirmDialog({ open, onOpenChange }: LogoutConfirmDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    // Revoke the server session/cookies (access + refresh) first, then clear the
    // local UI marker. Redirect regardless so the user is never stuck on failure.
    await logoutRequest().catch(() => undefined);
    clearDemoSession();
    router.push(routes.auth.login);
    // Keep `loading` true — the component unmounts on navigation, so resetting it
    // would only risk a flash of the enabled state.
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (loading ? undefined : onOpenChange(next))}>
      <DialogContent showCloseButton={false} className="max-w-xs">
        <DialogHeader className="items-center text-center">
          <span className="mb-1 flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive dark:bg-destructive/20">
            <LogOut className="size-5" />
          </span>
          <DialogTitle>Logout</DialogTitle>
          <DialogDescription>Are you sure you want to logout?</DialogDescription>
        </DialogHeader>
        <DialogFooter className="m-0 border-t-0 bg-transparent p-0 sm:justify-center">
          <Button
            variant="outline"
            className="flex-1"
            disabled={loading}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-destructive text-white hover:bg-destructive/90"
            disabled={loading}
            onClick={handleLogout}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
            {loading ? "Logging out…" : "Logout"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
