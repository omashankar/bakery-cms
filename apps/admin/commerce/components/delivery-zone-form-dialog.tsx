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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  describePincodeRule,
  findDeliveryZone,
  normalizePincode,
  zoneExcludesPincode,
} from "@/features/commerce/lib/delivery-zone-utils";
import { INDIAN_STATES, stateForPincode } from "@/features/commerce/lib/india-states";
import { cn } from "@/lib/utils";
import {
  createDeliveryZone,
  createEmptyDeliveryZone,
  updateDeliveryZone,
} from "@/features/commerce/lib/delivery-zones-repository";
import type { DeliveryZone, DeliveryZoneCoverage, DeliveryZoneFormData } from "@/types/delivery";

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

const COVERAGE_CHOICES: { value: DeliveryZoneCoverage; label: string; hint: string }[] = [
  { value: "pincodes", label: "PIN codes / areas", hint: "Chosen PIN codes, or every PIN starting with a few digits" },
  { value: "cities", label: "Cities", hint: "Every address in the cities you name" },
  { value: "states", label: "States", hint: "Whole states, worked out from the PIN code" },
  { value: "country", label: "All of India", hint: "Every PIN code — a catch-all rate" },
];

/** "324001, 3240\n324009" → ["324001", "3240", "324009"]: digits only, no repeats. */
function parsePincodes(text: string): string[] {
  const rules = text
    .split(/[\s,;]+/)
    .map((token) => normalizePincode(token))
    .filter(Boolean);
  return [...new Set(rules)];
}

/** "Kota, Bundi\nJaipur" → ["Kota", "Bundi", "Jaipur"], case-insensitively unique. */
function parseCities(text: string): string[] {
  const seen = new Set<string>();
  const cities: string[] = [];
  for (const raw of text.split(/[,\n;]+/)) {
    const city = raw.trim();
    if (!city || seen.has(city.toLowerCase())) continue;
    seen.add(city.toLowerCase());
    cities.push(city);
  }
  return cities;
}

interface CoverageDraft {
  coverage: DeliveryZoneCoverage;
  pincodesText: string;
  citiesText: string;
  states: string[];
  excludedText: string;
}

/**
 * The form's view of a zone's coverage.
 *
 * A zone saved before coverage existed opens as what it effectively was: its
 * PIN rule, or its city when it had none. Saving writes it in the new shape —
 * see the notice the dialog shows for the one case that changes behaviour.
 */
function draftOf(zone: DeliveryZone | null | undefined): CoverageDraft {
  if (!zone) {
    return { coverage: "pincodes", pincodesText: "", citiesText: "", states: [], excludedText: "" };
  }
  const excludedText = (zone.excludedPincodes ?? []).join(", ");
  if (zone.coverage) {
    return {
      coverage: zone.coverage,
      pincodesText: (zone.pincodes ?? []).join(", "),
      citiesText: (zone.cities ?? []).join(", "),
      states: zone.states ?? [],
      excludedText,
    };
  }
  const rule = normalizePincode(zone.pincode);
  return rule
    ? { coverage: "pincodes", pincodesText: rule, citiesText: zone.city, states: [], excludedText }
    : { coverage: "cities", pincodesText: "", citiesText: zone.city, states: [], excludedText };
}

export function DeliveryZoneFormDialog({
  open,
  onOpenChange,
  zone,
  onSaved,
}: DeliveryZoneFormDialogProps) {
  const [form, setForm] = useState<DeliveryZoneFormData>(createEmptyDeliveryZone());
  const [draft, setDraft] = useState<CoverageDraft>(() => draftOf(null));
  const [stateQuery, setStateQuery] = useState("");
  const [testPin, setTestPin] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft(draftOf(zone));
    setStateQuery("");
    setTestPin("");
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

  function patchDraft(patch: Partial<CoverageDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  const pincodes = parsePincodes(draft.pincodesText);
  const cities = parseCities(draft.citiesText);
  const excluded = parsePincodes(draft.excludedText);

  /**
   * The zone as it will be saved. Only the chosen coverage's list is kept —
   * the others are cleared, so a zone switched from States to Cities does not
   * carry a list nobody can see. `pincode` is emptied: a zone with a coverage
   * never reads it, and leaving the old rule there would show in exports as if
   * it still applied.
   */
  const zoneData: DeliveryZoneFormData = {
    ...form,
    coverage: draft.coverage,
    pincodes: draft.coverage === "pincodes" ? pincodes : undefined,
    cities: draft.coverage === "cities" ? cities : undefined,
    states: draft.coverage === "states" ? draft.states : undefined,
    excludedPincodes: excluded.length ? excluded : undefined,
    city: draft.coverage === "cities" ? cities.join(", ") : "",
    pincode: "",
  };

  /*
    THE ONE CASE WHERE SAVING CHANGES WHAT A ZONE DOES.

    An older zone with BOTH a PIN rule and a city also caught any address in
    that city when nothing else matched. The new shape covers one thing, so
    after saving it is the PIN rule alone. Said here, before the admin saves,
    rather than discovered when a customer in that city is charged the
    fallback fee.
  */
  const legacyCityFallback =
    zone && !zone.coverage && normalizePincode(zone.pincode) && zone.city.trim()
      ? zone.city.trim()
      : "";

  const visibleStates = INDIAN_STATES.filter((state) =>
    state.toLowerCase().includes(stateQuery.trim().toLowerCase()),
  );

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Give the zone a name");
      return;
    }
    if (draft.coverage === "pincodes" && pincodes.length === 0) {
      toast.error("Add at least one PIN code or PIN prefix");
      return;
    }
    if (draft.coverage === "cities" && cities.length === 0) {
      toast.error("Add at least one city");
      return;
    }
    if (draft.coverage === "states" && draft.states.length === 0) {
      toast.error("Choose at least one state");
      return;
    }

    if (form.minDeliveryDays > form.estimatedDeliveryDays) {
      toast.error("Minimum delivery time cannot be longer than the estimate");
      return;
    }

    if (zone) {
      const { persisted } = await updateDeliveryZone(zone.id, zoneData);
      reportWrite(persisted, "Delivery zone updated", {
        failure: "Could not update the zone — the server rejected it",
      });
    } else {
      const { persisted } = await createDeliveryZone(zoneData);
      reportWrite(persisted, "Delivery zone created", {
        failure: "Could not create the zone — the server rejected it",
      });
    }

    onOpenChange(false);
    onSaved?.();
  }

  /**
   * TRY A PIN AGAINST THIS ZONE, before saving it.
   *
   * Prefixes, state boundaries and a "leave out" list interact, and the only
   * way an owner could find out what a zone actually covered was to place a
   * test order. This answers from the same `findDeliveryZone` checkout uses,
   * on the zone exactly as it would be saved.
   */
  const testCode = normalizePincode(testPin);
  const testAnswer = (() => {
    if (testCode.length !== 6) return null;
    const draftZone: DeliveryZone = {
      ...zoneData,
      id: zone?.id ?? "draft",
      isActive: true,
      createdAt: "",
      updatedAt: "",
    };
    const state = stateForPincode(testCode);
    const where = state ? ` (${state})` : "";
    if (zoneExcludesPincode(draftZone, testCode)) {
      return { ok: false, text: `${testCode}${where} is left out of this zone.` };
    }
    if (draft.coverage === "cities") {
      return {
        ok: null,
        text: `A city zone matches on the city the customer types, not the PIN — ${testCode}${where} is covered if their address says ${cities.join(" or ") || "one of your cities"}.`,
      };
    }
    const match = findDeliveryZone([draftZone], { pincode: testCode });
    return match
      ? { ok: true, text: `${testCode}${where} is covered by this zone.` }
      : { ok: false, text: `${testCode}${where} is not in this zone.` };
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{zone ? "Edit delivery zone" : "Add delivery zone"}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Choose where this zone delivers, what it charges and how long it takes.
            When zones overlap, the narrowest one wins: a PIN code beats a city, a city
            beats a state, a state beats all of India.
          </p>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="zone-name">Zone name</Label>
            <Input
              id="zone-name"
              value={form.name}
              onChange={(event) => patch({ name: event.target.value })}
              placeholder="Kota city"
            />
          </div>

          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="mb-2 text-sm font-medium">This zone covers</legend>
            <div className="grid grid-cols-2 gap-2">
              {COVERAGE_CHOICES.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  aria-pressed={draft.coverage === choice.value}
                  onClick={() => patchDraft({ coverage: choice.value })}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    draft.coverage === choice.value
                      ? "border-foreground bg-muted font-medium"
                      : "border-border hover:bg-muted/60",
                  )}
                >
                  {choice.label}
                  <span className="block text-xs font-normal text-muted-foreground">
                    {choice.hint}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          {draft.coverage === "pincodes" ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="zone-pincodes">PIN codes / areas</Label>
              <Textarea
                id="zone-pincodes"
                rows={3}
                value={draft.pincodesText}
                onChange={(event) => patchDraft({ pincodesText: event.target.value })}
                placeholder="324001, 324005, 3240"
              />
              <p className="text-xs text-muted-foreground">
                Separate with commas or new lines. A full 6-digit PIN is that one area; fewer
                digits cover every PIN starting with them — 3240 is 324001 to 324099.
                {pincodes.length
                  ? ` ${pincodes.length} ${pincodes.length === 1 ? "rule" : "rules"}: ${pincodes.map(describePincodeRule).join(", ")}.`
                  : ""}
              </p>
            </div>
          ) : null}

          {draft.coverage === "cities" ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="zone-cities">Cities</Label>
              <Textarea
                id="zone-cities"
                rows={2}
                value={draft.citiesText}
                onChange={(event) => patchDraft({ citiesText: event.target.value })}
                placeholder="Kota, Bundi"
              />
              <p className="text-xs text-muted-foreground">
                Matched on the city the customer types at checkout, ignoring capitals. For an
                exact boundary, use PIN codes instead.
              </p>
            </div>
          ) : null}

          {draft.coverage === "states" ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="zone-state-search">States</Label>
              <Input
                id="zone-state-search"
                value={stateQuery}
                onChange={(event) => setStateQuery(event.target.value)}
                placeholder="Search states"
              />
              {/* The cap is on this wrapper, not the grid: a height-capped grid
                  shares the height out between its rows instead of scrolling. */}
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-2">
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                  {visibleStates.map((state) => {
                    const checked = draft.states.includes(state);
                    return (
                      <label key={state} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) =>
                            patchDraft({
                              states:
                                next === true
                                  ? [...draft.states, state]
                                  : draft.states.filter((entry) => entry !== state),
                            })
                          }
                        />
                        {state}
                      </label>
                    );
                  })}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {draft.states.length ? `${draft.states.length} chosen. ` : ""}
                The state is worked out from the customer&apos;s PIN code. Near a state border a
                PIN can land in the neighbouring state — add it to a PIN-code zone or leave it out
                below.
              </p>
            </div>
          ) : null}

          {draft.coverage === "country" ? (
            <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground sm:col-span-2">
              Every PIN code in India. Any narrower zone — a state, a city, a PIN — still wins
              where it applies, so this is the rate for everywhere else.
            </p>
          ) : null}

          {legacyCityFallback ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:col-span-2 dark:bg-amber-900/20 dark:text-amber-200">
              This older zone also covered any address in {legacyCityFallback} when no other zone
              did. After saving it covers only the PIN codes above — add a Cities zone for{" "}
              {legacyCityFallback} if you still want that.
            </p>
          ) : null}

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="zone-excluded">Leave out (optional)</Label>
            <Textarea
              id="zone-excluded"
              rows={2}
              value={draft.excludedText}
              onChange={(event) => patchDraft({ excludedText: event.target.value })}
              placeholder="324009, 3242"
            />
            <p className="text-xs text-muted-foreground">
              PIN codes or prefixes this zone does NOT deliver to, even inside what it covers.
              {excluded.length ? ` Leaving out ${excluded.map(describePincodeRule).join(", ")}.` : ""}
            </p>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="zone-test-pin">Try a PIN code</Label>
            <Input
              id="zone-test-pin"
              inputMode="numeric"
              value={testPin}
              onChange={(event) => setTestPin(normalizePincode(event.target.value))}
              placeholder="324005"
            />
            {testAnswer ? (
              <p
                className={cn(
                  "text-xs",
                  testAnswer.ok === true
                    ? "text-green-700"
                    : testAnswer.ok === false
                      ? "text-destructive"
                      : "text-muted-foreground",
                )}
              >
                {testAnswer.text}
              </p>
            ) : null}
          </div>

          {/*
            A "Radius (km)" box stood here and it decided NOTHING.

            `findDeliveryZone` matches on the PIN rules, the city, the state or
            the country — it never reads `radiusKm`, and nothing else does
            either, anywhere in the storefront or the checkout. The field was
            stored, validated, listed in the table and exported to CSV, and no
            customer was ever included or excluded by it.

            The harm is not the wasted box, it is what an owner believes while
            filling it in. Setting "8 km" beside a pincode rule of `324` reads
            as "Kota, within eight kilometres" — and the shop then quotes and
            accepts orders across the whole of 324xxx, which may be an hour's
            drive. The dialog's own hint said "Radius is for planning only",
            which is a note about what the field does not do, printed above a
            control that looked like it did it.

            The stored value stays on the records: nothing reads it, so it
            cannot mislead anyone from there, and dropping it from the type and
            the validator is a schema change with no benefit to pay for it.
          */}
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
