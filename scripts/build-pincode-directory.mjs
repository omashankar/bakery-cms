/**
 * Build the PIN code directory the delivery zones read real places from.
 *
 * LATEST, straight from the government (run this monthly — data.gov.in
 * refreshes the directory "till last month"):
 *
 *   DATA_GOV_IN_API_KEY=<key> node scripts/build-pincode-directory.mjs --download
 *
 * A key is free: sign in at data.gov.in → My Account → API key. The download
 * pages through the whole directory and REFUSES to write anything unless it
 * received every record the API says exists — an export that stops halfway
 * (the "limit=all" CSV link does) would silently drop real PIN codes, and
 * every customer at one would be told their PIN does not exist.
 *
 * From files already downloaded (same columns, any header case):
 *
 *   node scripts/build-pincode-directory.mjs <a.csv> [<b.csv> …] --updated 2025-10-03
 *
 * Source: India Post, "All India Pincode Directory till last month", Ministry
 * of Communications, Department of Posts — data.gov.in resource
 * 5c2f62fe-5afa-4119-a499-fec9d604d5bd, Government Open Data License – India.
 *
 * Writes features/commerce/server/data/india-pincodes.json, read only on the
 * server (see pincode-directory.ts), so none of it reaches a page's JavaScript:
 *
 *   updated:   "2025-10-03"  — when India Post last refreshed the directory
 *   states:    ["Andhra Pradesh", …]
 *   districts: [["Kota", <state index>], …]
 *   pins:      { "324005": [<state index>, <district index or [indexes]>, "Talwandi|Vigyan Nagar|…"] }
 *
 * A PIN's state is the one most of its post offices are in (a few dozen PINs
 * straddle a state line); every district it touches is kept, because a
 * district zone should catch a PIN that is partly inside it.
 *
 * Also writes india-pincode-points.json: where each PIN's post offices stand,
 * so a map pin can be given the PIN of the post offices nearest it (see
 * pincode-locator.ts). India Post's coordinates are rough: some are missing,
 * some have latitude and longitude swapped (put back), some sit hundreds of
 * km from the PIN's other offices (left out — 40 km from their median).
 *
 *   pins: { "324005": [251428, 758533, 251365, 758401, …] }  — lat, lng × 10⁴ (~11 m)
 */
import fs from "node:fs";
import path from "node:path";

const RESOURCE = "5c2f62fe-5afa-4119-a499-fec9d604d5bd";
const API = `https://api.data.gov.in/resource/${RESOURCE}`;
const PAGE = 10_000;
const OUT = path.join("features", "commerce", "server", "data", "india-pincodes.json");
const OUT_POINTS = path.join("features", "commerce", "server", "data", "india-pincode-points.json");
/** A post office further than this from its PIN's other offices is a typo in the directory. */
const OUTLIER_KM = 40;
const MAX_AREAS = 5;
const SMALL_WORDS = new Set(["and", "of", "the", "in"]);

// ---- reading CSV ----

/** RFC 4180: quoted or bare cells, "" inside quotes, CRLF or LF. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') cell += c;
      else if (text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else quoted = false;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Records out of one CSV text, as objects keyed by lower-case column name. */
function recordsOf(text) {
  const [header, ...rows] = parseCsv(text);
  const names = (header ?? []).map((name) => name.trim().toLowerCase());
  const records = [];
  let broken = 0;
  for (const row of rows) {
    if (row.length === 1 && row[0] === "") continue;
    // A row cut short — the tail of a truncated export — is not a record.
    if (row.length !== names.length) {
      broken += 1;
      continue;
    }
    records.push(Object.fromEntries(names.map((name, i) => [name, row[i].trim()])));
  }
  return { records, broken };
}

// ---- downloading ----

async function getText(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "bakery-cms pincode build" } });
    const text = await res.text();
    if (!res.ok || text.startsWith("{\n    \"error\"") || text.includes('"Rate limit exceeded"')) {
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 120)}`);
    }
    return text;
  } catch (error) {
    if (attempt >= 5) throw error;
    const wait = attempt * 5000;
    console.warn(`  retry ${attempt} in ${wait / 1000}s — ${error.message}`);
    await new Promise((resolve) => setTimeout(resolve, wait));
    return getText(url, attempt + 1);
  }
}

async function download(key) {
  const meta = JSON.parse(await getText(`${API}?api-key=${key}&format=json&offset=0&limit=1`));
  const total = Number(meta.total);
  const updated = String(meta.updated_date ?? "").slice(0, 10);
  if (!Number.isFinite(total) || total < 100_000) throw new Error(`implausible total ${meta.total}`);
  console.log(`data.gov.in: ${total} post offices, updated ${updated}`);

  const records = [];
  for (let offset = 0; offset < total; offset += PAGE) {
    const { records: page, broken } = recordsOf(
      await getText(`${API}?api-key=${key}&format=csv&offset=${offset}&limit=${PAGE}`),
    );
    if (broken) throw new Error(`page at ${offset} had ${broken} broken rows`);
    records.push(...page);
    console.log(`  ${records.length} / ${total}`);
  }
  if (records.length !== total) {
    throw new Error(`received ${records.length} of ${total} records — refusing to write a partial directory`);
  }
  return { records, updated };
}

// ---- names ----

/** "SAWAI MADHOPUR" → "Sawai Madhopur"; mixed case is left as written. */
function titleCase(text) {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed !== trimmed.toUpperCase()) return trimmed;
  return trimmed
    .toLowerCase()
    .split(" ")
    .map((word, i) =>
      // "I.P.I.A." stays an abbreviation rather than becoming "I.p.i.a.".
      word.includes(".") ? word.toUpperCase()
        : i > 0 && SMALL_WORDS.has(word) ? word : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

/** "THE DADRA AND NAGAR HAVELI AND DAMAN AND DIU" → "Dadra and Nagar Haveli and Daman and Diu". */
function stateName(raw) {
  return titleCase(raw).replace(/^The\s+/i, "");
}

const missing = (value) => !value || /^(na|n\/a|null|-)$/i.test(value.trim());

const officeType = /\s+(?:[BSHP]\.?\s?O\.?|NDC)$/i;

/** "Talwandi Kota S.O" → "Talwandi": the office type goes, and the district when something is left. */
function areaName(office, district) {
  // Twice: "Town Hall SO S.O" carries the type in both spellings.
  let name = titleCase(office.replace(officeType, "").replace(officeType, "").replace(/\.$/, ""));
  const suffix = ` ${district}`;
  if (name.toLowerCase().endsWith(suffix.toLowerCase()) && name.length > suffix.length) {
    name = name.slice(0, -suffix.length);
  }
  // "Town Hall SO Mumbai" carries the type before the district.
  return name.replace(officeType, "").trim();
}

// ---- where the post offices are ----

const inIndia = (lat, lng) => lat > 6 && lat < 37.6 && lng > 68 && lng < 97.6;

function kmBetween(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Each PIN's post offices as points, cleaned — see the header. */
function buildPoints(records, updated) {
  const byPin = new Map();
  let unusable = 0;
  for (const r of records) {
    const pin = String(r.pincode ?? "").trim();
    let lat = Number(r.latitude);
    let lng = Number(r.longitude);
    if (!/^[1-9]\d{5}$/.test(pin) || missing(r.latitude) || missing(r.longitude) || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      unusable += 1;
      continue;
    }
    if (!inIndia(lat, lng) && inIndia(lng, lat)) [lat, lng] = [lng, lat];
    if (!inIndia(lat, lng)) {
      unusable += 1;
      continue;
    }
    const list = byPin.get(pin) ?? [];
    list.push({ lat, lng });
    byPin.set(pin, list);
  }
  const median = (values) => [...values].sort((a, b) => a - b)[values.length >> 1];
  const out = {};
  let outliers = 0;
  let points = 0;
  for (const pin of [...byPin.keys()].sort()) {
    const list = byPin.get(pin);
    const middle = { lat: median(list.map((p) => p.lat)), lng: median(list.map((p) => p.lng)) };
    const seen = new Set();
    const flat = [];
    for (const p of list) {
      if (list.length > 2 && kmBetween(middle, p) > OUTLIER_KM) {
        outliers += 1;
        continue;
      }
      const lat = Math.round(p.lat * 1e4);
      const lng = Math.round(p.lng * 1e4);
      if (seen.has(`${lat},${lng}`)) continue;
      seen.add(`${lat},${lng}`);
      flat.push(lat, lng);
    }
    if (flat.length) {
      out[pin] = flat;
      points += flat.length / 2;
    }
  }
  fs.writeFileSync(OUT_POINTS, JSON.stringify({ updated, pins: out }));
  console.log(
    `${points} post office points for ${Object.keys(out).length} PIN codes (${unusable} without a usable place, ` +
      `${outliers} far from their PIN left out) → ${OUT_POINTS} (${fs.statSync(OUT_POINTS).size} bytes)`,
  );
}

// ---- building ----

function build(records, updated) {
  // Some rows say "NA" for the state. Their district (or failing that, their
  // postal circle) says where they are; a row with neither is left out.
  const districtStates = new Map();
  for (const r of records) {
    if (missing(r.statename) || missing(r.district)) continue;
    const key = titleCase(r.district);
    const counts = districtStates.get(key) ?? new Map();
    const state = stateName(r.statename);
    counts.set(state, (counts.get(state) ?? 0) + 1);
    districtStates.set(key, counts);
  }
  const knownStates = new Set([...districtStates.values()].flatMap((counts) => [...counts.keys()]));
  // The circles' own spellings differ from the states' ("Chattisgarh Circle").
  const CIRCLE_ALIASES = { Chattisgarh: "Chhattisgarh", Tamilnadu: "Tamil Nadu" };
  // Last resort: the state most PINs sharing the first three digits are in —
  // the North Eastern circle spans six states, so its name says nothing.
  const blockStates = new Map();
  for (const r of records) {
    if (missing(r.statename)) continue;
    const block = String(r.pincode ?? "").slice(0, 3);
    const counts = blockStates.get(block) ?? new Map();
    const state = stateName(r.statename);
    counts.set(state, (counts.get(state) ?? 0) + 1);
    blockStates.set(block, counts);
  }
  const majority = (counts) => [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const stateFor = (r) => {
    if (!missing(r.statename)) return stateName(r.statename);
    const counts = districtStates.get(titleCase(r.district ?? ""));
    if (counts) return majority(counts);
    const raw = stateName((r.circlename ?? "").replace(/\s+circle$/i, ""));
    const circle = CIRCLE_ALIASES[raw] ?? raw;
    if (knownStates.has(circle)) return circle;
    const block = blockStates.get(String(r.pincode ?? "").slice(0, 3));
    return block ? majority(block) : null;
  };

  let skipped = 0;
  const pins = new Map();
  for (const r of records) {
    const pin = String(r.pincode ?? "").trim();
    if (!/^[1-9]\d{5}$/.test(pin)) {
      skipped += 1;
      continue;
    }
    const state = stateFor(r);
    if (!state) {
      skipped += 1;
      continue;
    }
    const district = missing(r.district) ? "" : titleCase(r.district);
    let entry = pins.get(pin);
    if (!entry) {
      entry = { states: new Map(), districts: new Set(), offices: [] };
      pins.set(pin, entry);
    }
    entry.states.set(state, (entry.states.get(state) ?? 0) + 1);
    if (district) entry.districts.add(`${district}|${state}`);
    // Delivering town offices first, then villages, then counters that deliver nothing.
    // A sorting centre ("NDC Barkatpura") is not a place a customer lives in:
    // it keeps the PIN real, but is never shown as its area.
    if (/(^|\s)NDC(\s|$)/i.test(r.officename ?? "")) continue;
    const rank = (/^delivery$/i.test(r.delivery ?? "") ? 0 : 2) + (/^bo$/i.test(r.officetype ?? "") ? 1 : 0);
    entry.offices.push({ name: areaName(r.officename ?? "", district), rank });
  }

  const states = [];
  const stateIndex = new Map();
  const indexState = (name) => {
    if (!stateIndex.has(name)) {
      stateIndex.set(name, states.length);
      states.push(name);
    }
    return stateIndex.get(name);
  };
  const districts = [];
  const districtIndex = new Map();
  const indexDistrict = (key) => {
    if (!districtIndex.has(key)) {
      const [name, state] = key.split("|");
      districtIndex.set(key, districts.length);
      districts.push([name, indexState(state)]);
    }
    return districtIndex.get(key);
  };

  const out = {};
  for (const pin of [...pins.keys()].sort()) {
    const entry = pins.get(pin);
    const state = [...entry.states.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
    const ds = [...entry.districts].sort().map(indexDistrict);
    const areas = [];
    for (const office of entry.offices.sort((a, b) => a.rank - b.rank)) {
      if (office.name && !areas.includes(office.name)) areas.push(office.name);
      if (areas.length === MAX_AREAS) break;
    }
    out[pin] = [indexState(state), ds.length === 1 ? ds[0] : ds, areas.join("|")];
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(
    OUT,
    JSON.stringify({
      source: `India Post, All India Pincode Directory (data.gov.in, Government Open Data License - India), updated ${updated}`,
      updated,
      states,
      districts,
      pins: out,
    }),
  );
  console.log(
    `${records.length} post offices (${skipped} left out) → ${pins.size} PIN codes, ${districts.length} districts, ` +
      `${states.length} states → ${OUT} (${fs.statSync(OUT).size} bytes)`,
  );
}

// ---- main ----

const args = process.argv.slice(2);
if (args.includes("--download")) {
  const key = process.env.DATA_GOV_IN_API_KEY;
  if (!key) {
    console.error("Set DATA_GOV_IN_API_KEY (free at data.gov.in → My Account → API key).");
    process.exit(1);
  }
  const { records, updated } = await download(key);
  build(records, updated);
  buildPoints(records, updated);
} else {
  const updatedAt = args.indexOf("--updated");
  const updated = updatedAt >= 0 ? args[updatedAt + 1] : "";
  const files = args.filter((arg, i) => !arg.startsWith("--") && !(updatedAt >= 0 && i === updatedAt + 1));
  if (files.length === 0 || !/^\d{4}-\d{2}-\d{2}$/.test(updated)) {
    console.error(
      "usage: DATA_GOV_IN_API_KEY=<key> node scripts/build-pincode-directory.mjs --download\n" +
        "   or: node scripts/build-pincode-directory.mjs <a.csv> [<b.csv> …] --updated YYYY-MM-DD",
    );
    process.exit(1);
  }
  const records = [];
  for (const file of files) {
    const { records: rows, broken } = recordsOf(fs.readFileSync(file, "utf8"));
    if (broken) console.warn(`${file}: ${broken} broken row(s) left out — is the file complete?`);
    records.push(...rows);
  }
  build(records, updated);
  buildPoints(records, updated);
}
