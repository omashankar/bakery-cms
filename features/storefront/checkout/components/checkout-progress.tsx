import { cn } from "@/lib/utils";

const steps = [
  { id: 1, label: "Delivery" },
  { id: 2, label: "Payment" },
  { id: 3, label: "Review" },
] as const;

interface CheckoutProgressProps {
  currentStep: 1 | 2 | 3;
  className?: string;
}

export function CheckoutProgress({ currentStep, className }: CheckoutProgressProps) {
  return (
    <ol className={cn("flex items-center gap-2 sm:gap-4", className)}>
      {steps.map((step, index) => {
        const isComplete = step.id < currentStep;
        const isActive = step.id === currentStep;
        return (
          <li key={step.id} className="flex flex-1 items-center gap-2">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border text-sm font-semibold",
                  isComplete || isActive
                    ? "border-bakery-700 bg-bakery-700 text-white"
                    : "border-border bg-white text-muted-foreground"
                )}
              >
                {isComplete ? "✓" : step.id}
              </span>
              <span
                className={cn(
                  "truncate text-xs font-medium",
                  isActive ? "text-bakery-700" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 ? (
              <div
                className={cn(
                  "mb-5 hidden h-px flex-1 sm:block",
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
