import Link from "next/link";
import { Home } from "lucide-react";
import { RoutePlaceholder } from "@/components/shared/route-placeholder";
import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <RoutePlaceholder
        title="404 — Page Not Found"
        description="The page you're looking for doesn't exist or has been moved."
        phase={4}
        group="storefront"
        path="/404"
      />
      <div className="-mt-8 flex justify-center pb-16">
        <Button variant="bakery" render={<Link href={routes.store.home} />}>
          <Home className="size-4" />
          Back to Store
        </Button>
      </div>
    </div>
  );
}
