"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { reportWrite } from "@/apps/admin/lib/report-write";
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
import { normalizePincode } from "@/features/commerce/lib/delivery-zone-utils";
import {
  createDeliveryZone,
  createEmptyDeliveryZone,
  updateDeliveryZone,
} from "@/features/commerce/lib/delivery-zones-repository";
import type { DeliveryZone, DeliveryZoneFormData } from "@/types/delivery";

/**
 * Whole days, always.
 *
 * The server requires an integer (`z.number().int()`), and the write path saves
 * to localStorage BEFORE it PUTs — so a typed "1.5" was rejected by the server
 * and kept locally, and because every save sends the whole zone list, that one
 * character then made every SUBSEQUENT save fail too. The admin had no way to
 * see why and no way out but clearing site data.
 *
 * Rounded rather than refused: "1.5 days" has an obvious intention, and blocking
 * the keystroke mid-typing is worse than settling it on the way in.
 */
function wholeDays(value: string): number {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

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

  async function handleSubmit() {
    if (!form.name.trim() || !form.city.trim()) {
      toast.error("Zone name and city are required");
      return;
    }

    // Nothing stopped min > estimated, and the table then rendered "5–2 days".
    if (form.minDeliveryDays > form.estimatedDeliveryDays) {
      toast.error("Minimum delivery time cannot be longer than the estimate");
      return;
    }

    if (zone) {
      const { persisted } = await updateDeliveryZone(zone.id, form);
      reportWrite(persisted, "Delivery zone updated", {
        failure: "Could not update the zone — the server rejected it",
      });
    } else {
      const { persisted } = await createDeliveryZone(form);
      reportWrite(persisted, "Delivery zone created", {
        failure: "Could not create the zone — the server rejected it",
      });
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
              inputMode="numeric"
              value={form.pincode}
              // Normalised to what the MATCHER uses: digits only, six at most.
              // The field accepted anything, so "400 001" and a pasted list of
              // pincodes were silently truncated to something else entirely, and
              // a typo became a prefix zone covering a whole state.
              onChange={(event) => patch({ pincode: normalizePincode(event.target.value) })}
              placeholder="400001 or 4000"
            />
            <p className="text-xs text-muted-foreground">
              {form.pincode.length === 6
                ? "Exactly this pincode."
                : form.pincode
                  ? `Any pincode starting ${form.pincode}. Also covers the whole city as a fallback when no other zone matches.`
                  : "Matches the whole city — leave empty for a city-wide zone."}
            </p>
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
              step={1}
              value={form.minDeliveryDays}
              onChange={(event) => patch({ minDeliveryDays: wholeDays(event.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zone-est-days">Estimated delivery (days)</Label>
            <Input
              id="zone-est-days"
              type="number"
              min={0}
              step={1}
              value={form.estimatedDeliveryDays}
              onChange={(event) => patch({ estimatedDeliveryDays: wholeDays(event.target.value) })}
            />
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm sm:col-span-2">
            <span>Active zone</span>
            <Switch
              checked={form.isActive}
              aria-label="Active zone"
              onCheckedChange={(checked) => patch({ isActive: checked === true })}
            />
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="bakery" onClick={() => void handleSubmit()}>
            {zone ? "Save changes" : "Create zone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
