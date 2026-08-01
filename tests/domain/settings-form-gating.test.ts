/**
 * Every admin form that PUTs a whole settings section must hold its fields
 * closed until the server's copy has landed.
 *
 * This is a source-level test on purpose. The defect it guards is not a wrong
 * value from a function — it is a page that forgot to wire a gate, and the only
 * thing all the instances have in common is their shape. Four separate rounds of
 * this project fixed one screen at a time and each time another one was found
 * later, so the check is now a registry: a page cannot be added to the list
 * without being wired, and cannot be wired loosely without failing here.
 *
 * The sequence being guarded (see `features/settings/lib/use-settings-section.ts`):
 * `SettingsServerSync` reads the server's copy from a root-layout effect, so on
 * a hard load that read is still in flight while the fields are interactive and
 * the local store answers with the DEMO SEED. The admin types one character,
 * the form is dirty, the arriving server values are skipped by the very rule
 * that protects unsaved edits, and Save — a whole-section replace — pushes the
 * seed over the shop's real settings. Gating only the Save button is not
 * enough: the gate is already open by the time it is consulted.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function source(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

/**
 * Screens that edit a server-backed settings section.
 *
 * `fieldGate` names the mechanism that keeps the inputs out of reach while
 * hydration is pending: `SettingsSectionShell` does it via its `mounted` prop,
 * and screens built on `AdminPage` use `SettingsFormGate` directly.
 */
const SECTION_FORMS: Array<{ name: string; file: string; fieldGate: "shell" | "gate" }> = [
  // The three the commerce work covered.
  {
    name: "Commerce settings",
    file: "apps/admin/settings/components/commerce-settings-page.tsx",
    fieldGate: "shell",
  },
  { name: "Taxes", file: "apps/admin/commerce/pages/taxes-admin-page.tsx", fieldGate: "gate" },
  {
    name: "Shipping Rules",
    file: "apps/admin/commerce/pages/shipping-rules-admin-page.tsx",
    fieldGate: "gate",
  },
  // A fourth door into the SAME commerce section, found only after the first
  // three were sealed: this screen is about time slots but replaces the whole
  // section, tax rate included.
  {
    name: "Delivery Slots",
    file: "apps/admin/commerce/pages/delivery-slots-admin-page.tsx",
    fieldGate: "gate",
  },
  // Already on the shared hook before this work.
  {
    name: "General",
    file: "apps/admin/settings/components/general-settings-page.tsx",
    fieldGate: "shell",
  },
  {
    name: "Contact",
    file: "apps/admin/settings/components/contact-settings-page.tsx",
    fieldGate: "shell",
  },
  {
    name: "Social",
    file: "apps/admin/settings/components/social-settings-page.tsx",
    fieldGate: "shell",
  },
  {
    name: "Maintenance",
    file: "apps/admin/settings/components/maintenance-settings-page.tsx",
    fieldGate: "shell",
  },
  {
    name: "Modules",
    file: "apps/admin/settings/components/modules-settings-page.tsx",
    fieldGate: "shell",
  },
  // Hand-rolled until this pass. SMTP is the worst of them: the section holds
  // the mail password and the enabled switch, so a seed save blanks the
  // password and stops every outbound email — password resets included.
  {
    name: "SMTP",
    file: "apps/admin/settings/components/smtp-settings-page.tsx",
    fieldGate: "shell",
  },
  {
    name: "Security",
    file: "apps/admin/settings/components/security-settings-page.tsx",
    fieldGate: "shell",
  },
  {
    name: "Analytics",
    file: "apps/admin/settings/components/analytics-settings-page.tsx",
    fieldGate: "shell",
  },
];

describe("admin forms that replace a whole settings section", () => {
  it.each(SECTION_FORMS)("$name reads through the shared section form", ({ file }) => {
    const code = source(file);
    // Either directly, or through `useCommerceSettingsForm`, which is itself a
    // thin wrapper over it (asserted below).
    expect(
      code.includes("useSettingsSection") || code.includes("useCommerceSettingsForm"),
    ).toBe(true);
  });

  it.each(SECTION_FORMS)("$name never hand-rolls the one-shot mount read", ({ file }) => {
    const code = source(file);
    // The exact shape of the bug: seed BOTH copies from a synchronous
    // localStorage read and declare the form ready in the same tick.
    expect(code).not.toMatch(/setSavedSettings\(loaded\)/);
    expect(code).not.toMatch(/const \[savedSettings, setSavedSettings\] = useState/);
  });

  it.each(SECTION_FORMS)("$name holds its FIELDS closed until hydration", ({ file, fieldGate }) => {
    const code = source(file);
    if (fieldGate === "shell") {
      // The shell renders a skeleton while `mounted` is false.
      expect(code).toContain('mounted={hydration !== "pending"}');
    } else {
      expect(code).toContain("<SettingsFormGate hydration={hydration}>");
    }
  });

  it.each(SECTION_FORMS)("$name blocks saving until hydration too", ({ file, fieldGate }) => {
    const code = source(file);
    // Belt as well as braces: the field gate stops the admin EDITING the seed,
    // and this stops a save going out if anything ever slips past it.
    //
    // `canSave` has to appear in whatever disables the button — several pages
    // combine it with their own validity check (`hasErrors || !canSave`), which
    // is correct and must keep passing.
    expect(code).toMatch(
      fieldGate === "shell" ? /saveDisabled=\{[^}]*canSave/ : /disabled=\{[^}]*canSave/,
    );
  });

  it.each(SECTION_FORMS)("$name says so when the settings could not be read", ({ file }) => {
    const code = source(file);
    // Fields visible, saving refused, and a notice explaining why — showing the
    // seed read-only is more useful than an empty page, as long as it says so.
    //
    // The RENDERED element, not the import: an import alone satisfied this while
    // the notice was deleted from the JSX, which is exactly the silent-failure
    // mode this file exists to catch.
    expect(code).toMatch(/<SettingsHydrationNotice\s+hydration=\{hydration\}\s*\/>/);
  });
});

describe("the commerce form wrapper", () => {
  const code = source("apps/admin/commerce/lib/use-commerce-settings-form.ts");

  it("delegates to the shared section form rather than repeating it", () => {
    expect(code).toContain("useSettingsSection");
    expect(code).not.toContain("SETTINGS_UPDATED_EVENT");
  });

  it("exposes the hydration state its callers need to gate their fields", () => {
    expect(code).toContain("hydration");
    expect(code).toContain("canSave");
  });
});
