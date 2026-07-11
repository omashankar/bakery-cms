import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { AuthCard } from "@/features/auth/components/auth-card";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";

export function AuthErrorPage() {
  return (
    <AuthCard
      title="Something went wrong"
      description="We couldn't complete your authentication request."
    >
      <div className="space-y-4 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-xl bg-amber-50">
          <AlertTriangle className="size-8 text-amber-600" />
        </div>
        <p className="text-sm text-muted-foreground">
          Please try again or contact support if the issue persists.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="outline" render={<Link href={routes.auth.login} />}>
            Back to login
          </Button>
          <Button render={<Link href={routes.auth.forgotPassword} />}>
            Retry recovery
          </Button>
        </div>
      </div>
    </AuthCard>
  );
}
