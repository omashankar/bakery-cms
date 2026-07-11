import Link from "next/link";
import { Clock3 } from "lucide-react";
import { AuthCard } from "@/features/auth/components/auth-card";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";

export function AuthSessionExpiredPage() {
  return (
    <AuthCard
      title="Session expired"
      description="For your security, your session timed out due to inactivity."
    >
      <div className="space-y-4 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-xl bg-cream-100">
          <Clock3 className="size-8 text-bakery-700" />
        </div>
        <p className="text-sm text-muted-foreground">
          Please sign in again to continue managing your bakery.
        </p>
        <Button className="w-full" render={<Link href={routes.auth.login} />}>
          Sign in again
        </Button>
      </div>
    </AuthCard>
  );
}
