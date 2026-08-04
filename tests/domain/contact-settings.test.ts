/**
 * The Contact settings that reach a visitor's browser unchecked.
 *
 * `mapEmbedUrl` was `z.string().trim().optional()` — no shape, no scheme — and
 * the public contact page writes it straight into an `<iframe src>`. An iframe
 * runs whatever its `src` says, so that field was a script-injection point on
 * every visitor's contact page.
 *
 * The same field had a plainer failure that shipped far more often: it is
 * labelled "Google Maps embed URL", but Google's Share → "Embed a map" tab hands
 * you an entire `<iframe …></iframe>` snippet. Pasting what Google gives you
 * stored the HTML as the URL, and the map rendered blank with no error anywhere.
 */
import { describe, expect, it } from "vitest";

import { contactSchema } from "@/features/settings/server/settings.validators";
import {
  isValidMapEmbedUrl,
  normalizeMapEmbedUrl,
} from "@/features/settings/lib/settings-utils";

const GOOGLE_URL = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3768";

function contact(overrides: Record<string, unknown> = {}) {
  return {
    email: "hello@example.com",
    phone: "+91 90000 00000",
    address: "12 Bakery Lane",
    businessHours: [{ day: "Mon – Fri", hours: "9:00 AM – 8:00 PM" }],
    ...overrides,
  };
}

describe("the map embed URL", () => {
  it("unwraps the iframe snippet Google actually gives you", () => {
    const snippet = `<iframe src="${GOOGLE_URL}" width="600" height="450" style="border:0;" allowfullscreen loading="lazy"></iframe>`;
    expect(normalizeMapEmbedUrl(snippet)).toBe(GOOGLE_URL);

    // Single quotes and stray whitespace are just as likely from a copy-paste.
    expect(normalizeMapEmbedUrl(`  <iframe  src='${GOOGLE_URL}'  ></iframe> `)).toBe(GOOGLE_URL);
  });

  it("leaves a bare URL alone", () => {
    expect(normalizeMapEmbedUrl(`  ${GOOGLE_URL}  `)).toBe(GOOGLE_URL);
    expect(normalizeMapEmbedUrl("")).toBe("");
  });

  it("decodes the &amp; that any multi-parameter embed URL carries in an attribute", () => {
    // `&` is ALWAYS written `&amp;` inside an HTML attribute, so every provider
    // whose embed URL has more than one query parameter — OpenStreetMap, the
    // Maps Embed API v1, i.e. precisely the non-Google cases the https-only
    // rule exists to allow — unwrapped to a URL whose second parameter was
    // named `amp;layer` / `amp;q`. It validated, it stored, and the map
    // rendered blank with nothing saying why.
    const osm =
      '<iframe src="https://www.openstreetmap.org/export/embed.html?bbox=72.8,19.0,72.9,19.1&amp;layer=mapnik"></iframe>';
    expect(normalizeMapEmbedUrl(osm)).toBe(
      "https://www.openstreetmap.org/export/embed.html?bbox=72.8,19.0,72.9,19.1&layer=mapnik"
    );

    const v1 =
      '<iframe src="https://www.google.com/maps/embed/v1/place?key=AIza123&amp;q=Space+Needle"></iframe>';
    expect(normalizeMapEmbedUrl(v1)).toBe(
      "https://www.google.com/maps/embed/v1/place?key=AIza123&q=Space+Needle"
    );

    expect(normalizeMapEmbedUrl(`<iframe src="${GOOGLE_URL}&amp;hl=en"></iframe>`)).not.toContain(
      "amp;"
    );
  });

  it("unwraps uppercase and unquoted snippets, which a WYSIWYG or an older UI emits", () => {
    expect(normalizeMapEmbedUrl(`<IFRAME SRC="${GOOGLE_URL}"></IFRAME>`)).toBe(GOOGLE_URL);
    expect(normalizeMapEmbedUrl(`<iframe src=${GOOGLE_URL} width=600></iframe>`)).toBe(GOOGLE_URL);
  });

  it("accepts https, and any map provider — not just Google", () => {
    expect(isValidMapEmbedUrl(GOOGLE_URL)).toBe(true);
    expect(isValidMapEmbedUrl("https://www.openstreetmap.org/export/embed.html?bbox=1")).toBe(true);
    expect(isValidMapEmbedUrl("")).toBe(true);
  });

  it("refuses anything that would execute or be blocked in the frame", () => {
    expect(isValidMapEmbedUrl("javascript:alert(document.cookie)")).toBe(false);
    expect(isValidMapEmbedUrl("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
    // Mixed content — browsers block it anyway, so the map would just be blank.
    expect(isValidMapEmbedUrl("http://www.google.com/maps/embed?pb=1")).toBe(false);
    expect(isValidMapEmbedUrl("//evil.example/map")).toBe(false);
  });
});

describe("the contact section contract", () => {
  it("normalises a pasted snippet before storing it", () => {
    const parsed = contactSchema.parse(
      contact({ mapEmbedUrl: `<iframe src="${GOOGLE_URL}"></iframe>` })
    );
    expect(parsed.mapEmbedUrl).toBe(GOOGLE_URL);
  });

  it("rejects a map URL that could run script on the contact page", () => {
    expect(contactSchema.safeParse(contact({ mapEmbedUrl: "javascript:alert(1)" })).success).toBe(
      false
    );
  });

  it("rejects an opening-hours row with a blank half", () => {
    // A blank row renders as an empty line in the footer and on the contact
    // page, which reads as a broken site rather than as an unfilled row.
    expect(
      contactSchema.safeParse(contact({ businessHours: [{ day: "", hours: "9–5" }] })).success
    ).toBe(false);
    expect(
      contactSchema.safeParse(contact({ businessHours: [{ day: "Sunday", hours: "  " }] })).success
    ).toBe(false);

    expect(contactSchema.safeParse(contact()).success).toBe(true);
  });

  it("still allows an empty email, and still rejects a malformed one", () => {
    expect(contactSchema.safeParse(contact({ email: "" })).success).toBe(true);
    expect(contactSchema.safeParse(contact({ email: "not-an-email" })).success).toBe(false);
  });

  it("treats a whitespace-only email as empty, the way the browser already did", () => {
    // Written as `.trim().pipe(email).or(literal(""))` the union's second branch
    // compared the UNTRIMMED input, so clearing the field with a space was a
    // 422 — surfaced as "the server rejected it", which reads like an outage —
    // while the client's own check trimmed first and called it valid.
    expect(contactSchema.safeParse(contact({ email: "   " })).success).toBe(true);
    expect(contactSchema.parse(contact({ email: "  hi@shop.com  " })).email).toBe("hi@shop.com");
  });
});
