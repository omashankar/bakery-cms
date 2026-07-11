"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  createDeliveryZone,
  createEmptyDeliveryZone,
  updateDeliveryZone,
} from "../lib/delivery-zones-repository";
import type { DeliveryZone, DeliveryZoneFormData } from "@/types/delivery";

interface DeliveryZoneFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zone?: DeliveryZone | null;
  onSaved?: () => void;
}

export function DeliveryZoneFormDialog({
  open,
  onOpenChange,
  zone,
  onSaved,
}: DeliveryZoneFormDialogProps) {
  const [form, setForm] = useState<DeliveryZoneFormData>(createEmptyDeliveryZone());

  useEffect(() => {
    if (!open) return;
    if (zone) {
      setForm({
        name: zone.name,
        city: zone.city,
        pincode: zone.pincode,
        radiusKm: zone.radiusKm,
        deliveryCharge: zone.deliveryCharge,
        minDeliveryDays: zone.minDeliveryDays,
        estimatedDeliveryDays: zone.estimatedDeliveryDays,
        isActive: zone.isActive,
        priority: zone.priority,
      });
      return;
    }
    setForm(createEmptyDeliveryZone());
  }, [open, zone]);

  function patch(patch: Partial<DeliveryZoneFormData>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function handleSubmit() {
    if (!form.name.trim() || !form.city.trim()) {
      toast.error("Zone name and city are required");
      return;
    }

    if (zone) {
      updateDeliveryZone(zone.id, form);
      toast.success("Delivery zone updated");
    } else {
      createDeliveryZone(form);
      toast.success("Delivery zone created");
    }

    onOpenChange(false);
    onSaved?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{zone ? "Edit delivery zone" : "Add delivery zone"}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Use a full 6-digit pincode or a prefix (e.g. 4000). Radius is for planning only.
          </p>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="zone-name">Zone name</Label>
            <Input
              id="zone-name"
              value={form.name}
              onChange={(event) => patch({ name: event.target.value })}
              placeholder="Mumbai Central"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zone-city">City</Label>
            <Input
              id="zone-city"
              value={form.city}
              onChange={(event) => patch({ city: event.target.value })}
              placeholder="Mumbai"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zone-pincode">Pincode / prefix</Label>
            <Input
              id="zone-pincode"
              value={form.pincode}
              onChange={(event) => patch({ pincode: event.target.value })}
              placeholder="400001 or 4000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zone-radius">Radius (km)</Label>
            <Input
              id="zone-radius"
              type="number"
              min={0}
              value={form.radiusKm}
              onChange={(event) => patch({ radiusKm: Math.max(0, Number(event.target.value) || 0) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zone-charge">Delivery charge</Label>
            <Input
              id="zone-charge"
              type="number"
              min={0}
              value={form.deliveryCharge}
              onChange={(event) =>
                patch({ deliveryCharge: Math.max(0, Number(event.target.value) || 0) })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zone-priority">Priority</Label>
            <Input
              id="zone-priority"
              type="number"
              value={form.priority}
              onChange={(event) => patch({ priority: Number(event.target.value) || 0 })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zone-min-days">Min delivery time (days)</Label>
            <Input
              id="zone-min-days"
              type="number"
              min={0}
              value={form.minDeliveryDays}
              onChange={(event) =>
                patch({ minDeliveryDays: Math.max(0, Number(event.target.value) || 0) })
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zone-est-days">Estimated delivery (days)</Label>
            <Input
              id="zone-est-days"
              type="number"
              min={0}
              value={form.estimatedDeliveryDays}
              onChange={(event) =>
                patch({
                  estimatedDeliveryDays: Math.max(0, Number(event.target.value) || 0),
                })
              }
            />
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm sm:col-span-2">
            <span>Active zone</span>
            <Switch
              checked={form.isActive}
              onCheckedChange={(checked) => patch({ isActive: checked === true })}
            />
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="bakery" onClick={handleSubmit}>
            {zone ? "Save changes" : "Create zone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
