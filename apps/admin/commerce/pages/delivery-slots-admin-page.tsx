"use client";

import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, AdminPageHeader } from "@/apps/admin/components";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCommerceSettingsForm } from "../lib/use-commerce-settings-form";
import {
  SettingsFormGate,
  SettingsHydrationNotice,
} from "@/apps/admin/settings/components/settings-field-error";
import { useBusinessLabels } from "@/hooks/use-business-labels";

export function DeliverySlotsAdminPage() {
  const labels = useBusinessLabels();
  // `hydration` holds the fields closed until the server's copy lands. This
  // screen edits time slots but SAVES the whole commerce section — the tax
  // rate, the delivery fees, the minimum order value — so an unhydrated save
  // here resets settings that live on three other screens.
  const { settings, setSettings, savedSettings, isDirty, hydration, canSave, isWriting, save } =
    useCommerceSettingsForm();

  function updateSlot(index: number, value: string) {
    setSettings((prev) => ({
      ...prev,
      deliveryTimeSlots: prev.deliveryTimeSlots.map((slot, i) => (i === index ? value : slot)),
    }));
  }

  function addSlot() {
    setSettings((prev) => ({
      ...prev,
      deliveryTimeSlots: [...prev.deliveryTimeSlots, ""],
    }));
  }

  function removeSlot(index: number) {
    setSettings((prev) => {
      if (prev.deliveryTimeSlots.length <= 1) return prev;
      return {
        ...prev,
        deliveryTimeSlots: prev.deliveryTimeSlots.filter((_, i) => i !== index),
      };
    });
  }

  function discard() {
    setSettings(() => savedSettings);
  }

  function handleSave() {
    const cleanedSlots = settings.deliveryTimeSlots
      .map((slot) => slot.trim())
      .filter(Boolean);

    /**
     * Say so rather than inventing one.
     *
     * An all-blank list used to be silently replaced with `["10:00 AM – 12:00
     * PM"]` — a slot the admin never typed, saved under a toast that said
     * "Delivery slots saved", and then offered to every customer at checkout.
     * The server now enforces this list (an order for a slot the shop does not
     * offer is refused), which makes a slot nobody chose worse than none.
     */
    if (cleanedSlots.length === 0) {
      toast.error("Add at least one delivery time", {
        description: "Customers choose from this list at checkout, so it cannot be empty.",
      });
      return;
    }

    // `save` reports the server outcome itself.
    void save("Delivery slots saved", { ...settings, deliveryTimeSlots: cleanedSlots });
  }

  return (
    <AdminPage className="space-y-4 sm:space-y-5">
      <AdminPageHeader
        title="Delivery Slots"
        // Counts the rows on screen, deliberately: unlike the Taxes and
        // Shipping Rules headers, this makes no claim about what checkout is
        // doing — it summarises the list being edited, and the Discard/Save
        // buttons beside it say whether that list has been committed.
        description={hydration === "pending" ? "Loading delivery settings…" : `${settings.deliveryTimeSlots.length} time slot${settings.deliveryTimeSlots.length === 1 ? "" : "s"} · lead ${settings.deliveryLeadDays} day${settings.deliveryLeadDays === 1 ? "" : "s"}`}
        className="gap-3"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {isDirty ? (
              <Button variant="outline" className="w-full sm:w-auto" onClick={discard}>
                Discard
              </Button>
            ) : null}
            <Button
              variant="bakery"
              className="w-full sm:w-auto"
              disabled={!isDirty || !canSave}
              onClick={handleSave}
            >
              {isWriting ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      />

      <SettingsHydrationNotice hydration={hydration} />

      <SettingsFormGate hydration={hydration}>
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Lead time</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Sets the earliest selectable delivery date on {labels.productWord.toLowerCase()} pages.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="deliveryLeadDays">Earliest delivery (days from today)</Label>
            <Input
              id="deliveryLeadDays"
              type="number"
              min={0}
              value={settings.deliveryLeadDays}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  deliveryLeadDays: Math.max(0, Number(e.target.value) || 0),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="estimatedDeliveryDays">Estimated delivery window (days)</Label>
            <Input
              id="estimatedDeliveryDays"
              type="number"
              min={0}
              value={settings.estimatedDeliveryDays}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  estimatedDeliveryDays: Math.max(0, Number(e.target.value) || 0),
                }))
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base">Delivery time slots</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Shown on {labels.productWord.toLowerCase()} detail pages when customers schedule delivery.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={addSlot}>
            <Plus className="size-4" />
            Add slot
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {settings.deliveryTimeSlots.map((slot, index) => (
            <div key={`slot-${index}`} className="flex gap-2">
              <Input
                value={slot}
                onChange={(e) => updateSlot(index, e.target.value)}
                placeholder="e.g. 10:00 AM – 12:00 PM"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeSlot(index)}
                disabled={settings.deliveryTimeSlots.length <= 1}
                aria-label="Remove slot"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
      </SettingsFormGate>
    </AdminPage>
  );
}
