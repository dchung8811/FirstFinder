import { defineConfig } from "vitest/config";

// src/utils plus the pure filters in scripts/. Everything covered here has no
// DOM, no network, and no React, so it needs no environment beyond plain Node
// and a run stays fast enough to sit in front of every push.
//
// scripts/ is included for the seed script's title filters, which decide what
// is and is not a collectible book. Those rules were wrong twice in ways that
// silently deleted real first editions, so they are worth pinning even though
// the script around them talks to the network.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.js", "scripts/**/*.test.js"]
  }
});
