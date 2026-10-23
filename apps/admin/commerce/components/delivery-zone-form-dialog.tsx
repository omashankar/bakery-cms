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
  normalizePincode,
  zoneExcludesPincode,
} from "@/features/commerce/lib/delivery-zone-utils";
import {
  checkZoneDraft,
  describeMatch,
  explainPincode,
  pincodeRules,
  readPincodeList,
  type PincodeEntry,
} from "@/features/commerce/lib/delivery-zone-validation";
import { INDIAN_STATES } from "@/features/commerce/lib/india-states";
import { fetchDistricts, fetchPincodeInfo } from "@/features/commerce/lib/pincode-api";
import { getCommerceSettings } from "@/features/settings/lib/settings-repository";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";
import {
  createDeliveryZone,
  createEmptyDeliveryZone,
  updateDeliveryZone,
} from "@/features/commerce/lib/delivery-zones-repository";
import type {
  DeliveryZone,
  DeliveryZoneCoverage,
  DeliveryZoneFormData,
  DistrictEntry,
  PincodeInfo,
} from "@/types/delivery";

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
  /**
   * Every zone the shop has, so the form can refuse a PIN, city or state that
   * another live zone already claims, and answer "Try a PIN" across them all.
   */
  allZones: DeliveryZone[];
  onSaved?: () => void;
}

const COVERAGE_CHOICES: { value: DeliveryZoneCoverage; label: string; hint: string }[] = [
  { value: "pincodes", label: "PIN codes / areas", hint: "Chosen PIN codes, or every PIN starting with a few digits" },
  { value: "cities", label: "Districts", hint: "Every PIN in the districts you choose" },
  { value: "states", label: "States", hint: "Whole states, worked out from the PIN code" },
  { value: "country", label: "All of India", hint: "Every PIN code — a catch-all rate" },
];

/**
 * Each entry of a PIN box as a chip: the rule and its state, or — in red —
 * what is wrong with it. The owner sees "3240… Rajasthan" while typing, which
 * is how a 3420 meant as 3240 gets caught before a customer finds it.
 */
function PincodeChips({
  entries,
  directory,
}: {
  entries: PincodeEntry[];
  /** India Post's answer per rule, once it has arrived. */
  directory: Record<string, PincodeInfo>;
}) {
  if (entries.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="What these PIN codes mean">
      {entries.map((entry) => {
        const info = entry.rule ? directory[entry.rule] : undefined;
        const unreal =
          (info?.kind === "pin" && info.place === null) ||
          (info?.kind === "prefix" && info.summary.count === 0);
        const bad = Boolean(entry.problem) || unreal;
        return (
          <li
            key={entry.rule || entry.text}
            title={info?.kind === "pin" && info.place ? info.place.areas.join(", ") : (entry.problem ?? undefined)}
            className={cn(
              "rounded-md border px-2 py-0.5 text-xs",
              bad ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-border bg-muted/60",
            )}
          >
            {entry.problem ? (
              <>
                {entry.text} <span className="font-medium">· not valid</span>
              </>
            ) : (
              <>
                <span className="font-medium">{describePincodeRule(entry.rule)}</span>
                <span className={bad ? undefined : "text-muted-foreground"}> · {chipDetail(entry, info)}</span>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** "Talwandi, Kota" · "10 PINs · Kota" · "no such PIN" — what India Post says. */
function chipDetail(entry: PincodeEntry, info: PincodeInfo | undefined): string {
  if (!info) return entry.state ?? "…";
  if (info.kind === "pin") {
    if (!info.place) return "no such PIN";
    const district = info.place.districts[0] ?? "";
    const area = info.place.areas.find((name) => !name.includes(".") && name !== district);
    return [area, district].filter(Boolean).join(", ");
  }
  const { count, districts } = info.summary;
  if (count === 0) return "no real PIN starts with this";
  const where = districts.length <= 2 ? districts.join(", ") : `${districts.slice(0, 2).join(", ")} +${districts.length - 2}`;
  return `${count} PIN${count === 1 ? "" : "s"} · ${where}`;
}

/**
 * Each name in a Districts zone, checked against India Post's list: green with
 * its state and PIN count, red with a suggestion when no district has it.
 */
function DistrictChips({ names, districts }: { names: string[]; districts: DistrictEntry[] | null }) {
  if (names.length === 0 || !districts) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="What these districts are">
      {names.map((name) => {
        const matches = districts.filter((entry) => entry.name.toLowerCase() === name.trim().toLowerCase());
        const pins = matches.reduce((sum, entry) => sum + entry.pins, 0);
        return (
          <li
            key={name}
            className={cn(
              "rounded-md border px-2 py-0.5 text-xs",
              matches.length ? "border-border bg-muted/60" : "border-destructive/50 bg-destructive/10 text-destructive",
            )}
          >
            <span className="font-medium">{name}</span>
            {matches.length ? (
              <span className="text-muted-foreground">
                {" "}
                · {matches.map((entry) => entry.state).join(" / ")} · {pins} PINs
              </span>
            ) : (
              " · not a district"
            )}
          </li>
        );
      })}
    </ul>
  );
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
  allZones,
  onSaved,
}: DeliveryZoneFormDialogProps) {
  const [form, setForm] = useState<DeliveryZoneFormData>(createEmptyDeliveryZone());
  const [draft, setDraft] = useState<CoverageDraft>(() => draftOf(null));
  const [stateQuery, setStateQuery] = useState("");
  const [testPin, setTestPin] = useState("");
  // Blank fields are only called out once Save is pressed.
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  // What India Post says about each code typed so far, and every district.
  const [directory, setDirectory] = useState<Record<string, PincodeInfo>>({});
  const [districts, setDistricts] = useState<DistrictEntry[] | null>(null);
  const [districtPick, setDistrictPick] = useState("");

  useEffect(() => {
    if (!open) return;
    setDraft(draftOf(zone));
    setStateQuery("");
    setTestPin("");
    setAttempted(false);
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
    // A new zone starts from what the shop already charges and promises, not
    // from fixed numbers: the shop delivers same-day, and a zone that opened
    // at "1 day" quietly took same-day away from every PIN it covered.
    const commerce = getCommerceSettings();
    const minDays = Math.max(0, Math.round(commerce.deliveryLeadDays ?? 0));
    setForm({
      ...createEmptyDeliveryZone(),
      deliveryCharge: commerce.deliveryFee,
      minDeliveryDays: minDays,
      estimatedDeliveryDays: Math.max(minDays, Math.round(commerce.estimatedDeliveryDays ?? minDays)),
    });
  }, [open, zone]);

  function patch(patch: Partial<DeliveryZoneFormData>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function patchDraft(patch: Partial<CoverageDraft>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  const pincodeEntries = readPincodeList(draft.pincodesText);
  const excludedEntries = readPincodeList(draft.excludedText);
  const pincodes = pincodeRules(pincodeEntries);
  const cities = parseCities(draft.citiesText);
  const excluded = pincodeRules(excludedEntries);
  const others = allZones.filter((other) => other.id !== zone?.id);
  const testCode = normalizePincode(testPin);

  /*
    ASK INDIA POST about every code in the form, a moment after typing stops.
    The chips then say "Talwandi, Kota" or "no such PIN", and the checks below
    refuse a code no address can have. Remembered across edits, so a code is
    asked about once.
  */
  const codesToAsk = [...pincodes, ...excluded, ...(testCode.length === 6 ? [testCode] : [])]
    .filter((code) => !(code in directory))
    .join(",");
  useEffect(() => {
    if (!open || !codesToAsk) return;
    const timer = window.setTimeout(() => {
      void fetchPincodeInfo(codesToAsk.split(",")).then((found) => {
        if (found) setDirectory((prev) => ({ ...prev, ...found }));
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [open, codesToAsk]);

  const wantsDistricts = open && draft.coverage === "cities" && districts === null;
  useEffect(() => {
    if (!wantsDistricts) return;
    let alive = true;
    void fetchDistricts().then((list) => {
      if (alive && list) setDistricts(list);
    });
    return () => {
      alive = false;
    };
  }, [wantsDistricts]);

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

  const checkWith = (known: Record<string, PincodeInfo>, districtList = districts) =>
    checkZoneDraft({
      zone: { ...zoneData, id: zone?.id },
      pincodeEntries: draft.coverage === "pincodes" ? pincodeEntries : [],
      excludedEntries,
      others,
      directory: known,
      districts: districtList ?? undefined,
    });
  const problems = checkWith(directory);
  const blocking = [...problems.missing, ...problems.errors];
  // Wrong things are said as they are typed; blank ones only after Save.
  const shownErrors = attempted ? blocking : problems.errors;

  async function handleSubmit() {
    setAttempted(true);
    setSaving(true);
    try {
      // Save pressed before India Post answered: ask now, so a code that
      // does not exist cannot slip through on timing.
      const asked = await fetchPincodeInfo([...pincodes, ...excluded]);
      const known = asked ? { ...directory, ...asked } : directory;
      if (asked) setDirectory(known);
      const districtList =
        draft.coverage === "cities" ? (districts ?? (await fetchDistricts())) : districts;
      const final = checkWith(known, districtList);
      const stop = [...final.missing, ...final.errors];
      if (stop.length > 0) {
        toast.error(stop.length === 1 ? stop[0] : `Fix ${stop.length} problems before saving`);
        return;
      }

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

  /**
   * TRY A PIN — against this zone AND every other one, before saving.
   *
   * It used to test the draft on its own, so "324005 is covered by this zone"
   * was said of a PIN that a narrower zone elsewhere would actually win. This
   * answers from the same ranking checkout prices from, with the draft in
   * place of the saved copy, and names the zone that really gets the order.
   */
  const testAnswer = (() => {
    if (testCode.length !== 6) return null;
    const draftZone: DeliveryZone = {
      ...zoneData,
      id: zone?.id ?? "draft",
      // Tested as live, so a switched-off draft still answers for its area.
      isActive: true,
      createdAt: "",
      updatedAt: "",
    };
    const info = directory[testCode];
    // Undefined while India Post's answer is on its way: the digits answer.
    const place = info?.kind === "pin" ? info.place : undefined;
    const verdict = explainPincode(
      [draftZone, ...others],
      testCode,
      { ...getCommerceSettings(), useZoneBasedDelivery: true },
      formatCurrency,
      place,
    );
    if (!verdict) {
      return { ok: false, text: `${testCode} is not a valid PIN code.` };
    }
    if (place === null) {
      return { ok: false, text: `${testCode} is not a real PIN code — India Post has no such PIN.` };
    }
    const where = place
      ? ` (${[place.areas.find((name) => !name.includes(".")), place.districts[0], place.state].filter(Boolean).join(", ")})`
      : verdict.state
        ? ` (${verdict.state})`
        : "";
    if (zoneExcludesPincode(draftZone, testCode)) {
      return {
        ok: false,
        text: `${testCode}${where} is left out of this zone. ${verdict.outcome}`,
      };
    }
    if (verdict.winner?.zone.id === draftZone.id) {
      return { ok: true, text: `${testCode}${where} is delivered by this zone, through ${describeMatch(verdict.winner)}.` };
    }
    if (verdict.winner) {
      const thisCovers = verdict.alsoCovered.some((match) => match.zone.id === draftZone.id);
      return {
        ok: false,
        text: thisCovers
          ? `${testCode}${where} is in this zone, but "${verdict.winner.zone.name}" wins it — its rule is narrower.`
          : `${testCode}${where} is not in this zone — it goes to "${verdict.winner.zone.name}".`,
      };
    }
    return { ok: false, text: `${testCode}${where} is not in this zone. ${verdict.outcome}` };
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{zone ? "Edit delivery zone" : "Add delivery zone"}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Choose where this zone delivers, what it charges and how long it takes.
            Every PIN code is checked against India Post&apos;s list. When zones overlap, the
            narrowest one wins: a PIN code beats a district, a district beats a state, a state
            beats all of India.
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
                  ? ` ${pincodes.length} ${pincodes.length === 1 ? "rule" : "rules"}:`
                  : ""}
              </p>
              <PincodeChips entries={pincodeEntries} directory={directory} />
            </div>
          ) : null}

          {draft.coverage === "cities" ? (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="zone-cities">Districts</Label>
              <Textarea
                id="zone-cities"
                rows={2}
                value={draft.citiesText}
                onChange={(event) => patchDraft({ citiesText: event.target.value })}
                placeholder="Kota, Bundi"
              />
              {/* Picked from India Post's list, so the name is one a PIN can match. */}
              <div className="flex gap-2">
                <Input
                  aria-label="Find a district"
                  list="zone-district-options"
                  value={districtPick}
                  onChange={(event) => setDistrictPick(event.target.value)}
                  placeholder={districts ? "Find a district…" : "Loading districts…"}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!districtPick.trim()}
                  onClick={() => {
                    const name = districtPick.trim();
                    if (!cities.some((city) => city.toLowerCase() === name.toLowerCase())) {
                      patchDraft({ citiesText: [...cities, name].join(", ") });
                    }
                    setDistrictPick("");
                  }}
                >
                  Add
                </Button>
                <datalist id="zone-district-options">
                  {(districts ?? []).map((entry) => (
                    <option key={`${entry.name}|${entry.state}`} value={entry.name}>
                      {entry.state}
                    </option>
                  ))}
                </datalist>
              </div>
              <DistrictChips names={cities} districts={districts} />
              <p className="text-xs text-muted-foreground">
                Every PIN code India Post puts in these districts — decided from the
                customer&apos;s PIN, not from what they type as their city. A district is
                bigger than its city; for the city alone, use PIN codes.
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
              {excluded.length ? " Leaving out:" : ""}
            </p>
            <PincodeChips entries={excludedEntries} directory={directory} />
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
            <p className="text-xs text-muted-foreground">
              Rarely needed — the narrower zone already wins. Higher only breaks a tie.
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
