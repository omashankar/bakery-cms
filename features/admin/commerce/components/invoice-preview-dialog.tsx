"use client";

import { Printer } from "lucide-react";
import { InvoiceDocument } from "@/features/admin/commerce/components/invoice-document";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PlacedOrder } from "@/features/storefront/checkout/lib/orders";
import type { InvoiceSettings } from "@/types/invoice";

interface InvoicePreviewDialogProps {
  open: boolean;
  order: PlacedOrder | null;
  settings: InvoiceSettings;
  taxLabel: string;
  platformChargeLabel: string;
  giftWrapLabel: string;
  onOpenChange: (open: boolean) => void;
  onPrint: (order: PlacedOrder) => void;
}

export function InvoicePreviewDialog({
  open,
  order,
  settings,
  taxLabel,
  platformChargeLabel,
  giftWrapLabel,
  onOpenChange,
  onPrint,
}: InvoicePreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {order ? `Invoice ${order.orderNumber}` : "Invoice preview"}
          </DialogTitle>
        </DialogHeader>

        {order ? (
          <div className="rounded-xl bg-muted p-3 sm:p-4">
            <InvoiceDocument
              order={order}
              settings={settings}
              taxLabel={taxLabel}
              platformChargeLabel={platformChargeLabel}
              giftWrapLabel={giftWrapLabel}
              variant="screen"
            />
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {order ? (
            <Button
              variant="bakery"
              onClick={() => {
                onOpenChange(false);
                // Let the dialog unmount before opening the print dialog
                window.setTimeout(() => onPrint(order), 120);
              }}
            >
              <Printer className="size-4" />
              Print
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
