import Link from "next/link";

import { routes } from "@/constants/routes";
import { cn } from "@/lib/utils";

/**
 * Where the customer is in the one checkout this shop has.
 *
 * CART IS A STEP, and it was missing. The bar started at Delivery, so the cart
 * page — the screen a customer spends the longest on — showed no progress at
 * all, and the first thing the bar said after they left it was that they were
 * at the beginning.
 *
 * There is no "Personalize" step and this does not invent one. A message on the
 * cake, an uploaded photo and gift wrap are all controls on the product page and
 * in the cart; none of them is a screen, and a fourth circle that never lights
 * up is a promise the flow cannot keep.
 */
const steps = [
  { id: 0, label: "Cart" },
  { id: 1, label: "Delivery" },
  { id: 2, label: "Payment" },
  { id: 3, label: "Review" },
] as const;

interface CheckoutProgressProps {
  /** 0 is the cart page itself; 1-3 are the checkout screens. */
  currentStep: 0 | 1 | 2 | 3;
  /**
   * Jump back to an already-completed step. Completed steps show a tick, which
   * looks clickable — so it should be. Without this a customer who spots a typo
   * in their address on the Review screen has to press Back twice to reach it.
   *
   * Cart is not one of these: it is a route, not a step of the checkout form,
   * so it is a link and stays a link even when this is not passed.
   */
  onStepSelect?: (step: 1 | 2 | 3) => void;
  className?: string;
}

export function CheckoutProgress({
  currentStep,
  onStepSelect,
  className,
}: CheckoutProgressProps) {
  return (
    <ol className={cn("flex items-center gap-2 sm:gap-4", className)}>
      {steps.map((step, index) => {
        const isComplete = step.id < currentStep;
        const isActive = step.id === currentStep;
        // Only completed steps are navigable — jumping forward would skip
        // validation the later steps depend on.
        const canNavigate = isComplete && (step.id === 0 || Boolean(onStepSelect));

        const marker = (
          <>
            <span
              className={cn(
                "flex size-8 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                isComplete || isActive
                  ? "border-bakery-700 bg-bakery-700 text-white"
                  : "border-border bg-white text-muted-foreground",
                canNavigate && "group-hover:bg-bakery-800"
              )}
            >
              {/*
                Numbered by POSITION, not by id: the cart is step 0 in the code
                so that the checkout screens keep the 1-3 numbering every caller
                and every stored draft already uses.
              */}
              {isComplete ? "✓" : index + 1}
            </span>
            <span
              className={cn(
                "truncate text-xs font-medium",
                isActive ? "text-bakery-700" : "text-muted-foreground",
                canNavigate && "group-hover:text-bakery-800"
              )}
            >
              {step.label}
            </span>
          </>
        );

        const insideClassName =
          "group flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-lg focus-visible:ring-2 focus-visible:ring-bakery-700 focus-visible:outline-none";

        return (
          <li key={step.id} className="flex flex-1 items-center gap-2">
            {canNavigate && step.id === 0 ? (
              /*
                A LINK, not a button. Going back to the cart is a navigation,
                and it also keeps this out of the way of the checkout tests that
                hunt for buttons by name on the same screen.
              */
              <Link href={routes.store.cart} className={insideClassName}>
                {marker}
                <span className="sr-only">— completed, go back to edit</span>
              </Link>
            ) : canNavigate ? (
              <button
                type="button"
                onClick={() => onStepSelect?.(step.id as 1 | 2 | 3)}
                className={insideClassName}
              >
                {marker}
                <span className="sr-only">— completed, go back to edit</span>
              </button>
            ) : (
              <div
                aria-current={isActive ? "step" : undefined}
                className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
              >
                {marker}
              </div>
            )}
            {index < steps.length - 1 ? (
              <div
                className={cn(
                  // Visible on mobile too: disconnected circles do not read as
                  // a sequence.
                  "mb-5 h-px flex-1",
                  step.id < currentStep ? "bg-bakery-700" : "bg-border"
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
