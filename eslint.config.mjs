import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Architecture boundaries.
 *
 * `features/admin` (the CMS UI) and `features/storefront` (the customer website)
 * must never import each other. They used to, in both directions at once, which
 * made them impossible to split into separate apps. Anything both sides need is
 * business logic and belongs in a domain module — features/products, /orders,
 * /cart, /commerce, /catalog, /settings, /content, /reviews, /seo, /site-layout,
 * /inquiries, /builders — or, if it is UI, in components/shared.
 *
 * Keep these rules. They are what stops the cycle growing back.
 */
const adminImportsStorefront = {
  files: ["features/admin/**"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: ["@/features/storefront", "@/features/storefront/*", "**/features/storefront/*"],
            message:
              "features/admin must not import from features/storefront. Move the shared logic into a domain module (features/orders, features/products, ...) or, if it is UI, into components/shared.",
          },
        ],
      },
    ],
  },
};

const storefrontImportsAdmin = {
  files: [
    "features/storefront/**",
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
            group: ["@/features/admin", "@/features/admin/*", "**/features/admin/*"],
            message:
              "The customer website must not import from features/admin. Move the shared logic into a domain module (features/settings, features/content, ...) or, if it is UI, into components/shared.",
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
  ],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        patterns: [
          {
            group: [
              "@/features/admin",
              "@/features/admin/*",
              "**/features/admin/*",
              "@/features/storefront",
              "@/features/storefront/*",
              "**/features/storefront/*",
            ],
            message:
              "Domain modules must not depend on an app's UI layer. Business logic belongs here; the UI depends on it, never the reverse.",
          },
        ],
      },
    ],
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
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
