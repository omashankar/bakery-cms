import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite resolves the "@/*" tsconfig alias natively — no plugin needed.
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `import "server-only"` is a BUILD-TIME assertion: the package exists so
      // that bundling it into a client component fails loudly. It has no runtime
      // behaviour, and Next provides it only inside its own build — so a plain
      // vitest run cannot resolve it, and any module that guards itself this way
      // (gateway-credentials.server.ts, and anything importing it transitively)
      // could not be tested at all.
      //
      // Aliased to an empty module rather than removed from the source: the
      // guard is doing real work in the app, and dropping it to make a test pass
      // would trade a compile-time error for a leaked credential.
      "server-only": new URL("./tests/stubs/server-only.ts", import.meta.url).pathname,
    },
  },
  test: {
    // Repositories persist through localStorage, so the domain layer needs a DOM.
    environment: "jsdom",
    include: [
      "tests/**/*.test.ts",
      "features/**/*.test.ts",
      "lib/**/*.test.ts",
    ],
    restoreMocks: true,
  },
});
