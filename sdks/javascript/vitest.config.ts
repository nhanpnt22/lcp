import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "compression/**/*.ts",
        "consistency/**/*.ts",
        "entry/**/*.ts",
        "execution/**/*.ts",
        "failure/**/*.ts",
        "key/**/*.ts",
        "namespace/**/*.ts",
        "resume/**/*.ts",
        "singleflight/**/*.ts",
        "storage/**/*.ts",
        "swr/**/*.ts",
        "trace/**/*.ts",
        "ttl/**/*.ts",
        "validation/**/*.ts",
        "browser.global.entry.ts",
        "index.ts"
      ],
      exclude: ["**/*.d.ts", "examples/**", "dist/**", "min/**", "scripts/**", "tests/**"],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 80,
        statements: 85
      }
    }
  }
});
