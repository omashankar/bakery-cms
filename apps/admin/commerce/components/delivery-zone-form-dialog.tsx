"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
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
import { describeZoneCoverage } from "@/features/commerce/lib/delivery-zone-utils";
import { checkZoneDraft } from "@/features/commerce/lib/delivery-zone-validation";
import { decidesDelivery, isAreaZone, zoneShapes } from "@/features/commerce/lib/delivery-area";
import { getCommerceSettings, getContactSettings } from "@/features/settings/lib/settings-repository";
import { fetchDistricts, fetchPincodePlace } from "@/features/commerce/lib/pincode-api";
import { ZoneRegionPicker } from "./zone-region-picker";
import { contactInfo } from "@/constants/landing-data";
import { cn } from "@/lib/utils";
import {
  createDeliveryZone,
  createEmptyDeliveryZone,
  updateDeliveryZone,
} from "@/features/commerce/lib/delivery-zones-repository";
import type { DeliveryZone, DeliveryZoneFormData, DistrictEntry, LatLng, ZoneArea } from "@/types/delivery";
import { ZoneAreaEditor } from "./zone-area-editor";

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
  /** Every zone the shop has, so the form can warn of an overlap and refuse a repeated name. */
  allZones: DeliveryZone[];
  onSaved?: () => void;
}

type AreaKind = "map" | "cities" | "states";

/**
 * THE KINDS OF ZONE THAT DECIDE DELIVERY — all by where the customer's map
 * pin is (owner, 2026-10-27), never by the PIN typed: a Kota address with
 * Sangod's PIN was taken for Sangod.
 *
 * Areas drawn on the map — one or several circles and boundaries, so
 * Talwandi, Mahaveer Nagar and Vigyan Nagar can share one price — or whole
 * districts or states, the pin's own. PIN-code and all-of-India zones decide
 * nothing now and are not offered: a box that looks like it does something is
 * how the old "Radius (km)" box misled.
 */
const AREA_CHOICES: { value: AreaKind; label: string; hint: string }[] = [
  { value: "map", label: "On the map", hint: "One or more circles or boundaries you draw" },
  { value: "cities", label: "Whole districts", hint: "Every address in the districts you choose" },
  { value: "states", label: "Whole states", hint: "Every address in the states you choose" },
];

interface AreaDraft {
  kind: AreaKind;
  /** The zone's circles and boundaries, in order; one is edited at a time. */
  areas: ZoneArea[];
  selected: number;
  districts: string[];
  states: string[];
}

/** An area just added: a circle with no centre yet, or a boundary with no corners. */
function blankArea(kind: ZoneArea["kind"]): ZoneArea {
  return kind === "radius" ? { kind, center: undefined as unknown as LatLng, radiusKm: 0 } : { kind, polygon: [] };
}

function draftOf(zone: DeliveryZone | null | undefined): AreaDraft {
  const lists = {
    districts: zone?.coverage === "cities" ? (zone.cities ?? []) : [],
    states: zone?.coverage === "states" ? (zone.states ?? []) : [],
  };
  if (zone?.coverage === "cities" || zone?.coverage === "states") {
    return { kind: zone.coverage, areas: [blankArea("radius")], selected: 0, ...lists };
  }
  // One circle, one boundary or several — all open as the list they are.
  const areas = zone ? zoneShapes(zone) : [];
  return { kind: "map", areas: areas.length ? areas : [blankArea("radius")], selected: 0, ...lists };
}

/** "Circle · 5 km" / "Boundary · 4 corners" — an area's chip. */
function describeArea(area: ZoneArea): string {
  if (area.kind === "radius") return area.radiusKm > 0 && area.center ? `Circle · ${area.radiusKm} km` : "Circle · not placed";
  return area.polygon.length >= 3 ? `Boundary · ${area.polygon.length} corners` : "Boundary · not drawn";
}

/** The shop's own address — or "" while it is still the shipped demo one, which is in Mumbai. */
function shopAddress(): string {
  const address = getContactSettings().address?.trim() ?? "";
  return address && address !== contactInfo.address.trim() ? address : "";
}

/**
 * A place to open the map on, by name: an old zone's own PIN town ("Sangod,
 * Kota, Rajasthan", from India Post), district or state; for a new zone, the
 * shop's address — unless it is still the shipped demo one. "" when there is
 * nothing to go on, and the map opens on India.
 */
async function placeToOpenOn(zone: DeliveryZone | null | undefined, others: DeliveryZone[] = []): Promise<string> {
  // A new zone with no shop address set: the town an older zone was for.
  if (!zone) {
    const address = shopAddress();
    if (address) return address;
    const older = others.find((other) => !isAreaZone(other));
    return older ? placeToOpenOn(older) : "";
  }
  if (!isAreaZone(zone)) {
    const pin = [...(zone.pincodes ?? []), zone.pincode].map((code) => (code ?? "").replace(/\D/g, "")).find((code) => code.length === 6);
    if (pin) {
      const place = (await fetchPincodePlace(pin).catch(() => null))?.place;
      if (place) return [place.areas.find((name) => !name.includes(".")), place.districts[0], place.state].filter(Boolean).join(", ");
    }
    const named = zone.cities?.[0] ?? (zone.city?.trim() || zone.states?.[0]);
    if (named) return named;
  }
  return shopAddress();
}

export function DeliveryZoneFormDialog({
  open,
  onOpenChange,
  zone,
  allZones,
  onSaved,
}: DeliveryZoneFormDialogProps) {
  const [form, setForm] = useState<DeliveryZoneFormData>(createEmptyDeliveryZone());
  const [draft, setDraft] = useState<AreaDraft>(() => draftOf(null));
  // Blank fields are only called out once Save is pressed.
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  // Where the map opens for a zone with no area yet — see `ZoneAreaEditor.startHint`.
  const [startHint, setStartHint] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft(draftOf(zone));
    setAttempted(false);
    let alive = true;
    void placeToOpenOn(zone, allZones).then((hint) => {
      if (alive) setStartHint(hint);
    });
    if (zone) {
      setForm({
        name: zone.name,
        city: zone.city,
        pincode: zone.pincode,
        // A PIN-era zone's stored km was never read, so it is not carried over.
        radiusKm: 0,
        deliveryCharge: zone.deliveryCharge,
        minDeliveryDays: zone.minDeliveryDays,
        estimatedDeliveryDays: zone.estimatedDeliveryDays,
        isActive: zone.isActive,
        priority: zone.priority,
      });
      return () => {
        alive = false;
      };
    }
    // A new zone starts from what the shop already charges and promises, not
    // from fixed numbers: the shop delivers same-day, and a zone that opened
    // at "1 day" quietly took same-day away from every address it covered.
    const commerce = getCommerceSettings();
    const minDays = Math.max(0, Math.round(commerce.deliveryLeadDays ?? 0));
    setForm({
      ...createEmptyDeliveryZone(),
      deliveryCharge: commerce.deliveryFee,
      minDeliveryDays: minDays,
      estimatedDeliveryDays: Math.max(minDays, Math.round(commerce.estimatedDeliveryDays ?? minDays)),
    });
    return () => {
      alive = false;
    };
    // `allZones` only steers where the map opens; re-running on its identity would refetch for nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, zone]);

  function patch(patch: Partial<DeliveryZoneFormData>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  const others = allZones.filter((other) => other.id !== zone?.id);

  /**
   * The zone as it will be saved: its area, and nothing of a PIN-era rule — a
   * leftover list would show in exports as if it still applied.
   */
  // Saved as a list even when there is one area: one shape on every road.
  const zoneData: DeliveryZoneFormData = {
    ...form,
    coverage: draft.kind === "map" ? "areas" : draft.kind,
    areas: draft.kind === "map" ? draft.areas : undefined,
    center: undefined,
    polygon: undefined,
    radiusKm: 0,
    pincodes: undefined,
    cities: draft.kind === "cities" ? draft.districts : undefined,
    states: draft.kind === "states" ? draft.states : undefined,
    excludedPincodes: undefined,
    // Shown in the zone list and its export.
    city: draft.kind === "cities" ? draft.districts.join(", ") : "",
    pincode: "",
  };

  /* What an older zone used to cover, said before it is replaced by an area. */
  const legacyCovers = zone && !decidesDelivery(zone) ? describeZoneCoverage(zone).covers : "";

  // India Post's districts, so a name is one a pin's district can match.
  const [districtList, setDistrictList] = useState<DistrictEntry[] | null>(null);
  const wantsDistricts = open && draft.kind === "cities" && districtList === null;
  useEffect(() => {
    if (!wantsDistricts) return;
    let alive = true;
    void fetchDistricts().then((list) => {
      if (alive && list) setDistrictList(list);
    });
    return () => {
      alive = false;
    };
  }, [wantsDistricts]);

  const problems = checkZoneDraft({
    zone: { ...zoneData, id: zone?.id },
    pincodeEntries: [],
    excludedEntries: [],
    others,
    districts: districtList ?? undefined,
  });
  const blocking = [...problems.missing, ...problems.errors];
  // Wrong things are said as they are typed; blank ones only after Save.
  const shownErrors = attempted ? blocking : problems.errors;

  async function handleSubmit() {
    setAttempted(true);
    if (blocking.length > 0) {
      toast.error(blocking.length === 1 ? blocking[0] : `Fix ${blocking.length} problems before saving`);
      return;
    }
    setSaving(true);
    try {
      if (zone) {
        const { persisted } = await updateDeliveryZone(zone.id, zoneData);
        reportWrite(persisted, "Delivery zone updated", {
          failure: "Could not update the zone — the server rejected it",
        });
        // Left open on a refusal, with what was typed still in it.
        if (!persisted) return;
      } else {
        const { persisted } = await createDeliveryZone(zoneData);
        reportWrite(persisted, "Delivery zone created", {
          failure: "Could not create the zone — the server rejected it",
        });
        if (!persisted) return;
      }
    } finally {
      setSaving(false);
    }

    onOpenChange(false);
    onSaved?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{zone ? "Edit delivery zone" : "Add delivery zone"}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Choose where this zone delivers, then what it charges and how long it takes. At checkout
            the customer pins their door on a map, and the zone that holds the pin delivers it. Where
            zones overlap, the smaller wins: a circle or boundary, then a district, then a state.
          </p>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="zone-name">Zone name</Label>
            <Input
              id="zone-name"
              value={form.name}
              onChange={(event) => patch({ name: event.target.value })}
              placeholder="Sangod town"
            />
          </div>

          {legacyCovers ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 sm:col-span-2 dark:bg-amber-900/20 dark:text-amber-200">
              This zone was set up as &quot;{legacyCovers}&quot;. That no longer decides delivery — the
              customer&apos;s map pin does. Choose its area below; until you do, it delivers nowhere.
            </p>
          ) : null}

          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="mb-2 text-sm font-medium">This zone covers</legend>
            <div className="grid grid-cols-2 gap-2">
              {AREA_CHOICES.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  aria-pressed={draft.kind === choice.value}
                  onClick={() => setDraft((prev) => ({ ...prev, kind: choice.value }))}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                    draft.kind === choice.value
                      ? "border-foreground bg-muted font-medium"
                      : "border-border hover:bg-muted/60",
                  )}
                >
                  {choice.label}
                  <span className="block text-xs font-normal text-muted-foreground">{choice.hint}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="sm:col-span-2">
            {draft.kind === "map" ? (
              <div className="space-y-3">
                {/*
                  THE ZONE'S AREAS, as a row of chips: one is edited on the
                  map below, the rest are drawn dashed beside it. Several
                  mohallas at one price are one zone, not copies of it.
                */}
                <div className="flex flex-wrap items-center gap-2" role="list" aria-label="Areas in this zone">
                  {draft.areas.map((area, i) => (
                    <div
                      key={i}
                      role="listitem"
                      className={cn(
                        "flex items-center rounded-lg border text-xs",
                        i === draft.selected ? "border-foreground bg-muted font-medium" : "border-border",
                      )}
                    >
                      <button
                        type="button"
                        aria-pressed={i === draft.selected}
                        onClick={() => setDraft((prev) => ({ ...prev, selected: i }))}
                        className="px-2.5 py-1.5"
                      >
                        {i + 1}. {describeArea(area)}
                      </button>
                      {draft.areas.length > 1 ? (
                        <button
                          type="button"
                          aria-label={`Remove area ${i + 1}`}
                          onClick={() =>
                            setDraft((prev) => {
                              const areas = prev.areas.filter((_, j) => j !== i);
                              return { ...prev, areas, selected: Math.min(prev.selected, areas.length - 1) };
                            })
                          }
                          className="border-l border-border px-1.5 py-1.5 text-muted-foreground hover:text-destructive"
                        >
                          <X className="size-3.5" aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setDraft((prev) => ({ ...prev, areas: [...prev.areas, blankArea("radius")], selected: prev.areas.length }))}
                  >
                    <Plus className="size-3.5" aria-hidden /> Circle
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setDraft((prev) => ({ ...prev, areas: [...prev.areas, blankArea("polygon")], selected: prev.areas.length }))}
                  >
                    <Plus className="size-3.5" aria-hidden /> Boundary
                  </Button>
                </div>
                {(() => {
                  const area = draft.areas[draft.selected] ?? draft.areas[0];
                  return (
                    <ZoneAreaEditor
                      key={`${zone?.id ?? "new"}-${open ? "open" : "shut"}`}
                      kind={area.kind}
                      center={area.kind === "radius" ? area.center : undefined}
                      radiusKm={area.kind === "radius" ? area.radiusKm : 0}
                      polygon={area.kind === "polygon" ? area.polygon : undefined}
                      siblings={draft.areas.filter((_, i) => i !== draft.selected)}
                      focusKey={draft.selected}
                      others={others}
                      startHint={startHint}
                      onChange={(next) =>
                        setDraft((prev) => ({
                          ...prev,
                          areas: prev.areas.map((current, i) => {
                            if (i !== prev.selected) return current;
                            if (current.kind === "radius") {
                              return {
                                ...current,
                                ...(next.center ? { center: next.center } : {}),
                                ...(next.radiusKm !== undefined ? { radiusKm: next.radiusKm } : {}),
                              };
                            }
                            return next.polygon ? { ...current, polygon: next.polygon } : current;
                          }),
                        }))
                      }
                    />
                  );
                })()}
              </div>
            ) : (
              <ZoneRegionPicker
                kind={draft.kind}
                districts={draft.districts}
                states={draft.states}
                districtList={districtList}
                onChange={(next) => setDraft((prev) => ({ ...prev, ...next }))}
              />
            )}
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
            <p className="text-xs text-muted-foreground">
              Rarely needed — the smaller area already wins. Higher only breaks a tie.
            </p>
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

        {/*
          WHAT IS WRONG, said before Save rather than after a customer finds
          it. Errors block the save; warnings are things that will happen as
          written but may not be what was meant.
        */}
        {shownErrors.length > 0 || problems.warnings.length > 0 ? (
          <div className="space-y-2" aria-live="polite">
            {shownErrors.length > 0 ? (
              <ul
                role="alert"
                className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive"
              >
                {shownErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            ) : null}
            {problems.warnings.length > 0 ? (
              <ul className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                {problems.warnings.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="bakery" disabled={saving} onClick={() => void handleSubmit()}>
            {saving ? "Saving…" : zone ? "Save changes" : "Create zone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
