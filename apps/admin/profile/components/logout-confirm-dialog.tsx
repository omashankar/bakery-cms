"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { SIGN_OUT_FAILED, signOutOfThisDevice } from "@/features/auth/lib/sign-out";
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

    /**
     * The login page is the report, so it must not be shown for a sign-out that
     * did not happen.
     *
     * This discarded the server's answer and redirected "regardless so the user
     * is never stuck on failure". The failure it was routing around is the one
     * that matters: only the server clears the auth cookies, nothing guards
     * `/admin` in the browser, and the refresh cookie lasts thirty days. So on a
     * shared machine the admin landed on the login form, walked away, and the
     * next person to type /admin/orders was signed in as them.
     */
    const signedOut = await signOutOfThisDevice();
    if (!signedOut) {
      toast.error(SIGN_OUT_FAILED.title, { description: SIGN_OUT_FAILED.description });
      setLoading(false);
      return;
    }

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
