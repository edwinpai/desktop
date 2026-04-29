import path from "path";

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    pool: "forks",
    poolOptions: {
      forks: {
        maxForks: 2,
      },
    },
    testTimeout: 10000,
    setupFiles: ["./src/test/setup.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/e2e/**",
      "**/*.spec.ts",
      "./__tests__/**",
      "src/__tests__/**",
      "./onboarding-validation.spec.ts",
      "**/test/hooks/useSubscription.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.spec.ts",
        "**/*.spec.tsx",
        "**/test/**",
        "**/tests/**",
        "**/__mocks__/**",
        "**/node_modules/**",
        "**/dist/**",
        "**/.{idea,git,cache,output,temp}/**",
        "src/test/setup.ts",
        "src/main.tsx",
        "vite.config.ts",
        "vitest.config.ts",
        "eslint.config.js",
        "tailwind.config.js",
        "postcss.config.js",
      ],
      thresholds: {
        branches: 60,
        functions: 60,
        lines: 60,
        statements: 60,
      },
    },
  },
  resolve: {
    alias: {
      "@/components": path.resolve(__dirname, "src/components"),
      "@/lib": path.resolve(__dirname, "src/lib"),
      "@/hooks": path.resolve(__dirname, "src/hooks"),
      "@/stores": path.resolve(__dirname, "src/stores"),
      "@/types": path.resolve(__dirname, "src/types"),
    },
  },
});
