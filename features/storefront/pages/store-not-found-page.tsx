import Link from "next/link";
import { SearchX } from "lucide-react";
import { ScrollReveal } from "@/components/shared/scroll-reveal";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import { layoutSpacing } from "@/constants/spacing";

export function StoreNotFoundPage() {
  return (
    <section className={layoutSpacing.sectionY}>
      <div className={layoutSpacing.containerNarrow}>
        <ScrollReveal className="rounded-2xl border border-border bg-white p-8 text-center sm:p-12">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-xl bg-cream-100">
            <SearchX className="size-8 text-bakery-700" />
          </div>
          <h1 className="font-heading text-3xl font-bold">Page Not Found</h1>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Sorry, the page you are looking for does not exist or has been moved.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button render={<Link href={routes.store.home} />}>
              Back to Home
            </Button>
            <Button
              variant="outline"
              render={<Link href={routes.store.collections} />}
            >
              Browse Collections
            </Button>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
