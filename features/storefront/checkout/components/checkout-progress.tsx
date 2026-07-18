import { cn } from "@/lib/utils";

const steps = [
  { id: 1, label: "Delivery" },
  { id: 2, label: "Payment" },
  { id: 3, label: "Review" },
] as const;

interface CheckoutProgressProps {
  currentStep: 1 | 2 | 3;
  /**
   * Jump back to an already-completed step. Completed steps show a tick, which
   * looks clickable — so it should be. Without this a customer who spots a typo
   * in their address on the Review screen has to press Back twice to reach it.
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
        const canNavigate = isComplete && Boolean(onStepSelect);

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
              {isComplete ? "✓" : step.id}
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

        return (
          <li key={step.id} className="flex flex-1 items-center gap-2">
            {canNavigate ? (
              <button
                type="button"
                onClick={() => onStepSelect?.(step.id)}
                className="group flex min-w-0 flex-1 cursor-pointer flex-col items-center gap-1.5 rounded-lg focus-visible:ring-2 focus-visible:ring-bakery-700 focus-visible:outline-none"
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
                  // Visible on mobile too: three disconnected circles do not
                  // read as a sequence.
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
