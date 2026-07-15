"use client";

import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PaymentUIState =
  | "loading"
  | "redirecting"
  | "processing"
  | "success"
  | "failed"
  | "cancelled";

interface ProcessingAction {
  label: string;
  onClick: () => void;
  variant?: "bakery" | "outline" | "ghost";
  icon?: "retry" | "arrow";
}

interface ProcessingStateProps {
  state: PaymentUIState;
  title?: string;
  message?: string;
  /** Reason line for failed/cancelled. */
  reason?: string;
  actions?: ProcessingAction[];
  className?: string;
}

const PRESETS: Record<
  PaymentUIState,
  { title: string; message: string; tone: "brand" | "success" | "error" }
> = {
  loading: { title: "Preparing…", message: "Setting up your payment.", tone: "brand" },
  redirecting: {
    title: "Connecting to gateway…",
    message: "Opening the secure payment window.",
    tone: "brand",
  },
  processing: {
    title: "Verifying payment…",
    message: "Please don’t close or refresh this page.",
    tone: "brand",
  },
  success: {
    title: "Payment successful",
    message: "Your order is confirmed.",
    tone: "success",
  },
  failed: {
    title: "Payment failed",
    message: "We couldn’t process your payment.",
    tone: "error",
  },
  cancelled: {
    title: "Payment cancelled",
    message: "You closed the payment window before it completed.",
    tone: "error",
  },
};

const ActionIcon = { retry: RotateCcw, arrow: ArrowRight };

/** Reusable payment status screen. Used as an overlay during pay + inline on failure. */
export function ProcessingState({
  state,
  title,
  message,
  reason,
  actions,
  className,
}: ProcessingStateProps) {
  const preset = PRESETS[state];
  const isBusy = state === "loading" || state === "redirecting" || state === "processing";
  const tone = preset.tone;

  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-border bg-white p-8 text-center shadow-sm sm:p-10",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <span
        className={cn(
          "flex size-16 items-center justify-center rounded-2xl",
          tone === "success" && "bg-green-50 text-green-600",
          tone === "error" && "bg-red-50 text-red-600",
          tone === "brand" && "bg-cream-100 text-bakery-700"
        )}
      >
        {isBusy ? (
          <Loader2 className="size-8 animate-spin" />
        ) : tone === "success" ? (
          <CheckCircle2 className="size-8" />
        ) : (
          <XCircle className="size-8" />
        )}
      </span>

      <h2 className="mt-4 font-heading text-xl font-bold text-foreground">
        {title ?? preset.title}
      </h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        {message ?? preset.message}
      </p>
      {reason ? (
        <p className="mt-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
          {reason}
        </p>
      ) : null}

      {actions?.length ? (
        <div className="mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-center">
          {actions.map((action) => {
            const Icon = action.icon ? ActionIcon[action.icon] : null;
            return (
              <Button
                key={action.label}
                variant={action.variant ?? "outline"}
                onClick={action.onClick}
                className="sm:min-w-40"
              >
                {Icon ? <Icon className="size-4" /> : null}
                {action.label}
              </Button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
