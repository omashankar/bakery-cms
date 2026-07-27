"use client";

import { useRouter } from "next/navigation";
import { clearDemoSession } from "@/features/auth/lib/session";
import { logoutRequest } from "@/features/auth/lib/auth-api";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { routes } from "@/constants/routes";

export function AuthLogoutMenuItem() {
  const router = useRouter();

  return (
    <DropdownMenuItem
      onClick={async () => {
        // Clear the server session/cookies first, then the local UI marker.
        // Redirect happens regardless so the user is never stuck if the call fails.
        await logoutRequest().catch(() => undefined);
        clearDemoSession();
        router.push(routes.auth.login);
      }}
    >
      Logout
    </DropdownMenuItem>
  );
}
