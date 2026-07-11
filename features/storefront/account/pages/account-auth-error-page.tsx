import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { AccountAuthCard } from "@/features/storefront/account/components/account-auth-card";
import { StorePageHeader } from "@/features/storefront/components/store-page-header";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";

export function AccountAuthErrorPage() {
  return (
    <>
      <StorePageHeader
        title="Something Went Wrong"
        description="We couldn't complete your request."
        breadcrumbs={[{ label: "Error" }]}
      />
      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.containerNarrow}>
          <AccountAuthCard
            title="Authentication error"
            description="Please try again or contact our support team."
          >
            <div className="space-y-4 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-xl bg-amber-50">
                <AlertTriangle className="size-8 text-amber-600" />
              </div>
              <p className="text-sm text-muted-foreground">
                If the problem continues, reach us via the contact page.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" render={<Link href={routes.account.login} />}>
                  Back to login
                </Button>
                <Button variant="bakery" render={<Link href={routes.account.forgotPassword} />}>
                  Retry recovery
                </Button>
              </div>
            </div>
          </AccountAuthCard>
        </div>
      </section>
    </>
  );
}
