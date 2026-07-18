import Link from "next/link";

import { Button } from "@/components/ui/button";
import { routes } from "@/constants/routes";
import type { CartIssue } from "@/features/orders/lib/cart-validation";
import { cn } from "@/lib/utils";

interface CartIssuesAlertProps {
  issues: CartIssue[];
  className?: string;
}

/**
 * Why checkout is blocked.
 *
 * Shown at both the delivery and review steps: a disabled "Place order" with no
 * stated reason is the most frustrating state in the flow, so the explanation
 * has to travel with the block rather than live on one screen.
 */
export function CartIssuesAlert({ issues, className }: CartIssuesAlertProps) {
  if (issues.length === 0) return null;

  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm",
        className
      )}
    >
      <p className="font-medium text-destructive">Some items need your attention</p>
      <ul className="mt-2 space-y-1 text-muted-foreground">
        {issues.map((issue) => (
          <li key={issue.productSlug}>{issue.message}</li>
        ))}
      </ul>
      <Button variant="outline" className="mt-3" render={<Link href={routes.store.cart} />}>
        Update cart
      </Button>
    </div>
  );
}
