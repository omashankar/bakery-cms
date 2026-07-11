import Link from "next/link";
import { Clock3 } from "lucide-react";
import { AccountAuthCard } from "@/features/storefront/account/components/account-auth-card";
import { StorePageHeader } from "@/features/storefront/components/store-page-header";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";

export function AccountSessionExpiredPage() {
  return (
    <>
      <StorePageHeader
        title="Session Expired"
        description="Your session timed out for security."
        breadcrumbs={[{ label: "Session Expired" }]}
      />
      <section className={layoutSpacing.sectionY}>
        <div className={layoutSpacing.containerNarrow}>
          <AccountAuthCard
            title="Please sign in again"
            description="For your security, we signed you out after a period of inactivity."
          >
            <div className="space-y-4 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-xl bg-cream-100">
                <Clock3 className="size-8 text-bakery-700" />
              </div>
              <p className="text-sm text-muted-foreground">
                Sign in to access your orders, addresses, and wishlist.
              </p>
              <Button variant="bakery" className="w-full" render={<Link href={routes.account.login} />}>
                Sign in again
              </Button>
            </div>
          </AccountAuthCard>
        </div>
      </section>
    </>
  );
}
