import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { AccountAuthCard } from "@/features/storefront/account/components/account-auth-card";
import { StorePageHeader } from "@/features/storefront/components/store-page-header";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";

export function AccountAuthSuccessPage() {
  return (
    <>
      <StorePageHeader
        title="Password Updated"
        description="Your password has been changed successfully."
        breadcrumbs={[{ label: "Success" }]}
      />
      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.containerNarrow}>
          <AccountAuthCard
            title="All set!"
            description="You can now sign in with your new password."
          >
            <div className="space-y-4 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-xl bg-green-50">
                <CheckCircle2 className="size-8 text-green-600" />
              </div>
              <p className="text-sm text-muted-foreground">
                Your account is ready. Continue shopping or sign in to your dashboard.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" render={<Link href={routes.store.home} />}>
                  Continue shopping
                </Button>
                <Button variant="bakery" render={<Link href={routes.account.login} />}>
                  Sign in
                </Button>
              </div>
            </div>
          </AccountAuthCard>
        </div>
      </section>
    </>
  );
}
