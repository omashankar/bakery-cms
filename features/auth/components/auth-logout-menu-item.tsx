"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SIGN_OUT_FAILED, signOutOfThisDevice } from "@/features/auth/lib/sign-out";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { routes } from "@/constants/routes";

export function AuthLogoutMenuItem() {
  const router = useRouter();

  return (
    <DropdownMenuItem
      onClick={async () => {
        // The second copy of the sign-out that reported itself by redirecting.
        // See `signOutOfThisDevice`: only the server clears the auth cookies,
        // so the login page must not stand in for a sign-out that failed.
        const signedOut = await signOutOfThisDevice();
        if (!signedOut) {
          toast.error(SIGN_OUT_FAILED.title, { description: SIGN_OUT_FAILED.description });
          return;
        }
        router.push(routes.auth.login);
      }}
    >
      Logout
    </DropdownMenuItem>
  );
}
