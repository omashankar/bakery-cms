import type {
  DeliveryZone,
  DeliveryZoneFormData,
  DeliveryZoneMatch,
  DistrictEntry,
  PincodeInfo,
  PincodePlace,
} from "@/types/delivery";
import type { CommerceSettings } from "@/types/settings";
import {
  describePincodeRule,
  isFullPincode,
  normalizePincode,
  rankDeliveryZones,
} from "./delivery-zone-utils";
import { matchStateName, stateForPincode, type IndianState } from "./india-states";

/**
 * WHAT AN OWNER TYPED INTO A PIN BOX, READ ONE ENTRY AT A TIME.
 *
 * The box used to be read by `normalizePincode` on every token, which strips
 * what is not a digit and cuts at six: "Kota" vanished without a word,
 * "3240012" quietly became 324001, and "0324" became a rule no Indian PIN can
 * ever match. The zone saved, said it covered something, and covered nothing.
 * Every entry is now kept with what it was, so the form can say which one is
 * wrong and refuse to save it.
 */
export interface PincodeEntry {
  /** As typed. */
  text: string;
  /** The rule it becomes, or "" when it cannot be one. */
  rule: string;
  /** Why it cannot be a rule, or null. */
  problem: string | null;
  /** The state its PINs are in, when the digits say. */
  state: IndianState | null;
}

/** A PIN rule needs this many digits; fewer than a sorting district spans states. */
export const MIN_PIN_RULE_DIGITS = 3;

function readEntry(text: string): PincodeEntry {
  const digits = text.replace(/\D/g, "");
  const problem = /[a-z]/i.test(text)
    ? `"${text}" is not a PIN code`
    : digits.length > 6
      ? `"${text}" has more than 6 digits`
      : digits.startsWith("0")
        ? `"${text}" — no Indian PIN code starts with 0`
        : digits.length < MIN_PIN_RULE_DIGITS
          ? `"${text}" is too short — use at least ${MIN_PIN_RULE_DIGITS} digits (like 324), or choose States for a bigger area`
          : null;
  return {
    text,
    rule: problem ? "" : digits,
    problem,
    state: problem ? null : stateForPincode(digits),
  };
}

/**
 * "324001, 3240\n324 009" → one entry each, repeats dropped.
 *
 * Commas, semicolons and new lines always separate. A space separates too,
 * except inside one code written the way it is printed on letters — "324 009"
 * is one PIN, "324001 324005" is two.
 */
export function readPincodeList(text: string): PincodeEntry[] {
  const entries: PincodeEntry[] = [];
  const seen = new Set<string>();
  for (const segment of text.split(/[,;\n]+/)) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const oneCode = /^[\d\s-]+$/.test(trimmed) && trimmed.replace(/\D/g, "").length <= 6;
    for (const token of oneCode ? [trimmed] : trimmed.split(/\s+/)) {
      const entry = readEntry(token);
      const key = entry.rule || `!${entry.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push(entry);
    }
  }
  return entries;
}

/** The rules out of a list, the broken entries left behind. */
export function pincodeRules(entries: PincodeEntry[]): string[] {
  return entries.filter((entry) => entry.rule).map((entry) => entry.rule);
}

/** Whether every PIN under `inner` is also under `outer` ("324001" inside "3240"). */
function ruleInside(inner: string, outer: string): boolean {
  return inner.startsWith(outer);
}

/** Whether two rules share any PIN at all. */
function rulesOverlap(a: string, b: string): boolean {
  return a.startsWith(b) || b.startsWith(a);
}

/**
 * What a zone claims, in one shape whatever it was saved as. A zone from
 * before `coverage` claims its PIN rule, or its city when it has none — the
 * city behind a PIN rule is a fallback that any city zone outranks.
 */
function claimsOf(zone: Pick<DeliveryZone, "coverage" | "pincodes" | "cities" | "states" | "pincode" | "city">) {
  const legacyRule = zone.coverage ? "" : normalizePincode(zone.pincode);
  return {
    pincodes: zone.coverage === "pincodes"
      ? (zone.pincodes ?? []).map(normalizePincode).filter(Boolean)
      : legacyRule ? [legacyRule] : [],
    cities: (zone.coverage === "cities"
      ? (zone.cities ?? [])
      : !zone.coverage && !legacyRule ? [zone.city] : []
    ).map((city) => city.trim().toLowerCase()).filter(Boolean),
    states: zone.coverage === "states"
      ? (zone.states ?? []).map(matchStateName).filter((state): state is IndianState => Boolean(state))
      : [],
    country: zone.coverage === "country",
  };
}

export interface ZoneDraft {
  /** The zone exactly as it would be saved. */
  zone: DeliveryZoneFormData & { id?: string };
  /** The coverage box's entries — read only when the zone covers PIN codes. */
  pincodeEntries: PincodeEntry[];
  /** The "leave out" box's entries. */
  excludedEntries: PincodeEntry[];
  /** Every OTHER zone the shop has. */
  others: DeliveryZone[];
  /**
   * India Post's answer for each PIN rule (from /api/pincodes). Absent until
   * it arrives, and then the checks that need it are skipped rather than
   * guessed — the server still refuses a malformed rule.
   */
  directory?: Record<string, PincodeInfo>;
  /** Every real district, for checking a Cities zone's names. */
  districts?: DistrictEntry[];
}

/** Up to two districts that look like what was typed: "Kotah" → "Kota". */
export function closestDistricts(typed: string, districts: DistrictEntry[]): string[] {
  const want = typed.trim().toLowerCase();
  if (want.length < 3) return [];
  const scored = new Map<string, number>();
  for (const { name } of districts) {
    const have = name.toLowerCase();
    const score = have.startsWith(want) || want.startsWith(have)
      ? 0
      : have.includes(want) || want.includes(have)
        ? 1
        : have.slice(0, 3) === want.slice(0, 3)
          ? 2
          : -1;
    if (score >= 0 && !(scored.get(name)! <= score)) scored.set(name, score);
  }
  return [...scored.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].length - b[0].length || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .map(([name]) => name);
}

export interface ZoneProblems {
  /**
   * Not filled in yet. Blocks saving like an error, but a form says these only
   * once Save is pressed — a blank new zone is not a mistake.
   */
  missing: string[];
  /** Filled in wrong. The zone must not be saved while any of these stand. */
  errors: string[];
  /** Saved as it is, but probably not what was meant. */
  warnings: string[];
}

const MAX_LISTED = 4;

function listed(items: string[]): string {
  return items.length <= MAX_LISTED
    ? items.join(", ")
    : `${items.slice(0, MAX_LISTED).join(", ")} and ${items.length - MAX_LISTED} more`;
}

/**
 * EVERYTHING WRONG WITH A ZONE BEFORE IT IS SAVED.
 *
 * Errors are the zones that cannot do what the owner thinks they do: a PIN that
 * is not one, a list that leaves out everything it covers, and — the one that
 * cost real money — the SAME PIN, city or state in two live zones. Two zones
 * claiming 324001 were settled by priority and then by price, so the zone a
 * customer was charged for depended on a number field nobody reads; now one
 * place belongs to one zone, and the form says which zone already has it.
 *
 * A narrower rule inside a broader zone ("324001" inside "3240…") is NOT an
 * error: that is how a shop prices one area differently, and the narrower one
 * always wins. It is a warning, so the owner sees it happen.
 */
export function checkZoneDraft({
  zone,
  pincodeEntries,
  excludedEntries,
  others,
  directory,
  districts,
}: ZoneDraft): ZoneProblems {
  const missing: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const name = zone.name.trim();

  if (!name) missing.push("Give the zone a name.");
  const sameName = others.find((other) => other.name.trim().toLowerCase() === name.toLowerCase());
  if (name && sameName) {
    errors.push(`Another zone is already called "${sameName.name.trim()}" — give this one its own name.`);
  }

  const coverage = zone.coverage ?? "pincodes";
  const covered = coverage === "pincodes" ? pincodeRules(pincodeEntries) : [];
  const excluded = pincodeRules(excludedEntries);

  if (coverage === "pincodes") {
    for (const entry of pincodeEntries) if (entry.problem) errors.push(`PIN codes: ${entry.problem}.`);
    if (covered.length === 0) missing.push("Add at least one PIN code or PIN prefix.");
    if (directory) {
      // India Post's own list decides what is real — the zone covers nothing
      // through a code that no address can have.
      const fakePins = covered.filter((rule) => {
        const info = directory[rule];
        return info?.kind === "pin" && info.place === null;
      });
      if (fakePins.length) {
        errors.push(`${listed(fakePins)} is not a real PIN code — India Post has no such PIN. Check the digits.`);
      }
      const emptyPrefixes = covered.filter((rule) => {
        const info = directory[rule];
        return info?.kind === "prefix" && info.summary.count === 0;
      });
      if (emptyPrefixes.length) {
        errors.push(`No real PIN code starts with ${listed(emptyPrefixes.map(describePincodeRule))} — check the digits.`);
      }
    } else {
      const unknown = covered.filter((rule) => !stateForPincode(rule));
      if (unknown.length) {
        warnings.push(`No Indian state starts with ${listed(unknown.map(describePincodeRule))} — check for a typo.`);
      }
    }
    const insideOwn = covered.filter((rule) =>
      covered.some((other) => other !== rule && ruleInside(rule, other)),
    );
    if (insideOwn.length) {
      warnings.push(`${listed(insideOwn.map(describePincodeRule))} is already inside a shorter code in this zone — not needed.`);
    }
  }

  if (coverage === "cities") {
    const cities = zone.cities ?? [];
    if (cities.length === 0) missing.push("Add at least one city.");
    const pins = cities.filter((city) => /^\d[\d\s]*$/.test(city.trim()));
    if (pins.length) {
      errors.push(`${listed(pins)} is a PIN code, not a city — choose "PIN codes / areas" for PIN codes.`);
    }
    if (districts && districts.length > 0) {
      // A city zone matches the DISTRICT India Post puts the customer's PIN
      // in. A name that is no district ("Kotah", "Navi Mumbai") would match
      // nobody, while the list said the zone covered it.
      const known = new Set(districts.map((entry) => entry.name.toLowerCase()));
      const strangers = cities.filter(
        (city) => !/^\d/.test(city.trim()) && !known.has(city.trim().toLowerCase().replace(/\s+/g, " ")),
      );
      for (const city of strangers) {
        const hint = closestDistricts(city, districts);
        errors.push(
          `"${city}" is not a district in India Post's list, so no customer would match it.` +
            (hint.length ? ` Did you mean ${hint.map((name) => `"${name}"`).join(" or ")}?` : " Pick a district from the suggestions, or use PIN codes."),
        );
      }
    }
  }

  if (coverage === "states" && (zone.states ?? []).length === 0) {
    missing.push("Choose at least one state.");
  }

  for (const entry of excludedEntries) if (entry.problem) errors.push(`Leave out: ${entry.problem}.`);

  // A leave-out that swallows what the zone covers.
  if (coverage === "pincodes" && covered.length) {
    const swallowed = covered.filter((rule) => excluded.some((out) => ruleInside(rule, out)));
    if (swallowed.length === covered.length) {
      errors.push("Everything this zone covers is also in Leave out — it would deliver nowhere.");
    } else if (swallowed.length) {
      warnings.push(`${listed(swallowed.map(describePincodeRule))} is covered and also left out, so it is left out.`);
    }
  }

  // A leave-out that is not inside the zone at all does nothing.
  const pointless = excluded.filter((out) => {
    if (coverage === "pincodes") return !covered.some((rule) => rulesOverlap(rule, out));
    if (coverage === "states") {
      const state = stateForPincode(out);
      return Boolean(state) && !(zone.states ?? []).some((name) => matchStateName(name) === state);
    }
    return false;
  });
  if (pointless.length) {
    warnings.push(`Leaving out ${listed(pointless.map(describePincodeRule))} changes nothing — it is not inside this zone.`);
  }

  if (zone.minDeliveryDays > zone.estimatedDeliveryDays) {
    errors.push("Min delivery time cannot be longer than the estimated delivery time.");
  }

  // Against the shop's other LIVE zones. A switched-off zone decides nothing,
  // so a draft or a switched-off zone may overlap freely.
  if (zone.isActive) {
    const mine = claimsOf({ ...zone, pincodes: covered });
    for (const other of others) {
      if (!other.isActive) continue;
      const theirs = claimsOf(other);
      const theirOut = (other.excludedPincodes ?? []).map(normalizePincode).filter(Boolean);
      const label = `"${other.name.trim() || "another zone"}"`;

      const same = mine.pincodes.filter(
        (rule) =>
          theirs.pincodes.includes(rule) &&
          !theirOut.some((out) => ruleInside(rule, out)) &&
          !excluded.some((out) => ruleInside(rule, out)),
      );
      if (same.length) {
        errors.push(
          `${listed(same.map(describePincodeRule))} is already in ${label}. One PIN code can be in only one zone — remove it from one of them.`,
        );
      }
      const narrower = mine.pincodes.filter(
        (rule) => !same.includes(rule) && theirs.pincodes.some((theirRule) => rule !== theirRule && rulesOverlap(rule, theirRule)),
      );
      if (narrower.length) {
        warnings.push(
          `${listed(narrower.map(describePincodeRule))} overlaps ${label} — where they overlap, the zone with the longer PIN code wins.`,
        );
      }

      const cities = mine.cities.filter((city) => theirs.cities.includes(city));
      if (cities.length) {
        errors.push(`${listed(cities)} is already in ${label}. One city can be in only one zone.`);
      }
      const states = mine.states.filter((state) => theirs.states.includes(state));
      if (states.length) {
        errors.push(`${listed(states)} is already in ${label}. One state can be in only one zone.`);
      }
      if (mine.country && theirs.country) {
        errors.push(`${label} already covers all of India — only one zone can.`);
      }
    }
  }

  return { missing, errors, warnings };
}

const MATCHED_BY: Record<DeliveryZoneMatch["matchType"], string> = {
  pincode: "its PIN codes",
  city: "its district",
  state: "its state",
  country: "all of India",
};

/** "its PIN codes" — the part of a zone that caught an address. */
export function describeMatch(match: DeliveryZoneMatch): string {
  return MATCHED_BY[match.matchType];
}

export interface PincodeVerdict {
  pincode: string;
  state: IndianState | null;
  /** The zone checkout will charge, or null. */
  winner: DeliveryZoneMatch | null;
  /** Other live zones that cover it too, and lose. */
  alsoCovered: DeliveryZoneMatch[];
  /** What checkout does with it, in one sentence. */
  outcome: string;
  /** False when checkout refuses the PIN. */
  delivered: boolean;
  /** India Post's place, null for no such PIN, undefined when not asked. */
  place?: PincodePlace | null;
}

/**
 * WHERE ONE PIN CODE GOES — the whole map, answered for one address.
 *
 * The same `rankDeliveryZones` checkout prices from, plus the shop's switches,
 * so what the owner reads here is what a customer at that PIN is charged.
 * Null until the code is a complete PIN.
 */
export function explainPincode(
  zones: DeliveryZone[],
  entered: string,
  rules: Pick<
    CommerceSettings,
    "useZoneBasedDelivery" | "deliverOutsideZones" | "zoneFallbackDeliveryFee" | "deliveryFee"
  >,
  formatMoney: (amount: number) => string,
  /** India Post's answer for the PIN — see `ZoneAddress.place`. */
  place?: PincodePlace | null,
): PincodeVerdict | null {
  const pincode = normalizePincode(entered);
  if (!isFullPincode(pincode)) return null;
  const state = (place ? matchStateName(place.state) : null) ?? stateForPincode(pincode);

  if (place === null) {
    return {
      pincode,
      state,
      place,
      winner: null,
      alsoCovered: [],
      delivered: false,
      outcome: "India Post has no such PIN code — the storefront tells a customer to check the digits.",
    };
  }

  if (!rules.useZoneBasedDelivery) {
    return {
      pincode,
      state,
      place,
      winner: null,
      alsoCovered: [],
      delivered: true,
      outcome: `Zone pricing is off (Shipping rules), so every order pays the flat fee of ${formatMoney(rules.deliveryFee)} — no zone is used.`,
    };
  }

  const [winner = null, ...alsoCovered] = rankDeliveryZones(zones, { pincode, place });
  if (winner) {
    return {
      pincode,
      state,
      place,
      winner,
      alsoCovered,
      delivered: true,
      outcome: `Delivered by "${winner.zone.name}" for ${formatMoney(winner.zone.deliveryCharge)}.`,
    };
  }

  const refused = rules.deliverOutsideZones === false;
  return {
    pincode,
    state,
    place,
    winner: null,
    alsoCovered: [],
    delivered: !refused,
    outcome: refused
      ? "No zone covers it, and the shop delivers only inside its zones — checkout refuses this PIN code."
      : `No zone covers it — checkout charges the fallback fee of ${formatMoney(rules.zoneFallbackDeliveryFee ?? rules.deliveryFee)}.`,
  };
}
