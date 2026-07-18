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
 */
const domainStaysPure = {
  files: [
    "features/products/**",
    "features/orders/**",
    "features/cart/**",
    "features/commerce/**",
    "features/catalog/**",
    "features/settings/**",
    "features/content/**",
    "features/reviews/**",
    "features/seo/**",
    "features/site-layout/**",
    "features/inquiries/**",
    "features/builders/**",
    "features/cms-sections/**",
    "features/payments/**",
  ],
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
