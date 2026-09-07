import { defineConfig } from "vitest/config";

// Only src/utils is covered. Those modules are pure -- no DOM, no network, no
// React -- so they need no environment beyond plain Node, and a test run stays
// fast enough to sit in front of every push.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.js"]
  }
});
