import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Architecture boundaries.
 *
 * `apps/admin` (the CMS UI) and `apps/website` (the customer website)
 * must never import each other. They used to, in both directions at once, which
 * made them impossible to split into separate apps. Anything both sides need is
 * business logic and belongs in a domain module — features/products, /orders,
 * /cart, /commerce, /catalog, /settings, /content, /reviews, /seo, /site-layout,
 * /inquiries, /builders — or, if it is UI, in components/shared.
 *
 * Keep these rules. They are what stops the cycle growing back.
 */
const adminImportsStorefront = {
  files: ["apps/admin/**"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@/apps/website", "@/apps/website/*", "**/apps/website/*"],
            message:
              "apps/admin must not import from apps/website. Move the shared logic into a domain module (features/orders, features/products, ...) or, if it is UI, into components/shared.",
          },
        ],
      },
    ],
  },
};

const storefrontImportsAdmin = {
  files: [
    "apps/website/**",
    "features/landing/**",
    "features/cms-sections/**",
    "components/storefront/**",
    "app/(storefront)/**",
    "app/account/**",
  ],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@/apps/admin", "@/apps/admin/*", "**/apps/admin/*"],
            message:
              "The customer website must not import from apps/admin. Move the shared logic into a domain module (features/settings, features/content, ...) or, if it is UI, into components/shared.",
          },
        ],
      },
    ],
  },
};

/**
 * Domain modules are the reusable core: business logic only. They must not
 * depend on either app's UI layer, or they stop being reusable.
 *
 * This rule used to name the directories it guarded, one string at a time:
 * features/products, /orders, /cart, /commerce, /catalog, /settings,
 * /content, /reviews, /seo, /site-layout, /inquiries, /builders,
 * /cms-sections, /payments. Fourteen entries -- and features/ held
 * twenty-nine directories. The other fifteen were never argued to be exempt;
 * nobody had typed them out yet, so a feature born after the list was written
 * was born outside the boundary. The rule still READ like a complete
 * architectural statement, which is why nobody went looking.
 *
 * What that cost: features/inventory, features/checkout,
 * features/communications, features/media and features/admin-config all
 * reached into an app's UI layer -- nine imports across six files -- and the
 * linter reported none of them. The one violation it ever caught,
 * features/orders pulling deriveStockStatus out of apps/admin, was caught
 * only because /orders happened to be on the list. Two of the misses had
 * already closed into cycles: apps/admin/profile/lib/admin-profile.ts and
 * apps/admin/settings/lib/custom-code-repository.ts imported
 * features/admin-config/lib/admin-config-api, a sibling of the very module
 * that was importing them back.
 *
 * So the pattern is the whole of features/ and the default is now guarded. A
 * directory added tomorrow is inside the boundary the moment it exists;
 * nobody has to remember to widen anything. An exemption now has to be
 * written into `ignores` with its reason beside it, which is the right way
 * round -- silence should not grant one.
 *
 * One limit, stated here so this docblock does not repeat the mistake it
 * describes by reading as absolute: `no-restricted-imports` sees static
 * `import`/`export ... from` only. A dynamic `import("@/apps/...")` inside a
 * feature passes, which was confirmed against this config rather than assumed.
 * Nothing under features/ does that today -- the only dynamic imports there are
 * type-position `import("@/types/...")` -- so this is a latent hole, not an open
 * one. Close it with a `no-restricted-syntax` selector on ImportExpression if a
 * real one ever appears.
 */
const domainStaysPure = {
  files: ["features/**"],
  // Deliberate exemptions only -- add a directory here WITH the reason it
  // needs an app import. Empty on purpose: nothing under features/ has ever
  // had a legitimate one.
  ignores: [],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: [
              "@/apps/admin",
              "@/apps/admin/*",
              "**/apps/admin/*",
              "@/apps/website",
              "@/apps/website/*",
              "**/apps/website/*",
            ],
            message:
              "Domain modules must not depend on an app's UI layer. Business logic belongs here; the UI depends on it, never the reverse.",
          },
        ],
      },
    ],
  },
};

/**
 * Shared UI is shared, which means it may not reach back into an app.
 *
 * The docblock at the top of this file names components/shared as the place UI
 * goes when both sides need it — and components/shared was the one destination
 * it named that had no rule of its own. So it drifted the way the domain
 * modules had: six imports of `@/apps/admin` across four files, none reported.
 *
 * The two shapes it drifted into are worth naming, because they are different
 * mistakes. `filter-panel.tsx` was never shared at all — all twenty-two of its
 * importers were admin screens, and it pulled `adminShell` for its styling — so
 * it moved to apps/admin, where it always belonged. The appearance modules were
 * the opposite: genuinely needed by both, but parked under apps/admin because
 * the admin wrote them first, so the storefront had to reach across to paint
 * the shop palette. They moved down beside `appearance-tokens`, which had
 * already made exactly that journey for exactly that reason.
 *
 * Ask which one a new violation is before reaching for an exemption: UI only
 * one app uses belongs in that app, and UI both use belongs here with its logic
 * in a domain module.
 */
const sharedUiStaysShared = {
  files: ["components/shared/**"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: [
              "@/apps/admin",
              "@/apps/admin/*",
              "**/apps/admin/*",
              "@/apps/website",
              "@/apps/website/*",
              "**/apps/website/*",
            ],
            message:
              "components/shared must not import from an app. If only one app uses it, move it into that app; if both do, move the logic into a domain module and keep the component here.",
          },
        ],
      },
    ],
  },
};

/**
 * The codebase already marks deliberately-discarded bindings with a leading
 * underscore — `const { id: _id, ...data } = record` to strip a field. Honour
 * that convention so the real unused-variable warnings stay visible.
 */
const underscoreMeansIntentional = {
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
        ignoreRestSiblings: true,
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  underscoreMeansIntentional,
  adminImportsStorefront,
  storefrontImportsAdmin,
  domainStaysPure,
  sharedUiStaysShared,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
