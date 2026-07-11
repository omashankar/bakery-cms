"use client";

import { useRouter } from "next/navigation";
import { clearDemoSession } from "@/features/auth/lib/session";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { routes } from "@/constants/routes";

export function AuthLogoutMenuItem() {
  const router = useRouter();

  return (
    <DropdownMenuItem
      onClick={() => {
        clearDemoSession();
        router.push(routes.auth.login);
      }}
    >
      Logout
    </DropdownMenuItem>
  );
}
