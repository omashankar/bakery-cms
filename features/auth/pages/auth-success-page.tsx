import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { AuthCard } from "@/features/auth/components/auth-card";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";

export function AuthSuccessPage() {
  return (
    <AuthCard
      title="Password updated"
      description="Your password has been changed successfully."
    >
      <div className="space-y-4 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-xl bg-green-50">
          <CheckCircle2 className="size-8 text-green-600" />
        </div>
        <p className="text-sm text-muted-foreground">
          You can now sign in using your new credentials.
        </p>
        <Button className="w-full" render={<Link href={routes.auth.login} />}>
          Go to login
        </Button>
      </div>
    </AuthCard>
  );
}
