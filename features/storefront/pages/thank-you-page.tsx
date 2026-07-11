import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";

export function ThankYouPage() {
  return (
    <section className={layoutSpacing.sectionY}>
      <div className={layoutSpacing.containerNarrow}>
        <div className="rounded-2xl border border-border bg-white p-8 text-center sm:p-12">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl bg-green-50">
            <CheckCircle2 className="size-8 text-green-600" />
          </div>
          <h1 className="font-heading text-3xl font-bold">Thank You!</h1>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Your inquiry has been submitted successfully. Our team will get back
            to you within 24 hours.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button render={<Link href={routes.store.home} />}>
              Back to Home
            </Button>
            <Button
              variant="outline"
              render={<Link href={routes.store.collections} />}
            >
              Browse Cakes
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
