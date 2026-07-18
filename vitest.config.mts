import { defineConfig } from "vitest/config";

export default defineConfig({
  // Vite resolves the "@/*" tsconfig alias natively — no plugin needed.
  resolve: { tsconfigPaths: true },
  test: {
    // Repositories persist through localStorage, so the domain layer needs a DOM.
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
    restoreMocks: true,
  },
});
