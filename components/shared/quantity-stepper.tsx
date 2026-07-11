import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 10,
  className,
}: QuantityStepperProps) {
  return (
    <div className={cn("inline-flex items-center rounded-lg border border-border bg-white", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Decrease quantity"
      >
        <Minus className="size-3.5" />
      </Button>
      <span className="min-w-8 text-center text-sm font-semibold">{value}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Increase quantity"
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  );
}
