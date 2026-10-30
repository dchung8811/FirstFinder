// The Features page's entries, bundled for the phone in
// ios/FirstFinder/Resources/Features.json from src/content/features.js.
// Fails when the bundle falls behind; UPDATE=1 rewrites it:
//
//   UPDATE=1 npx vitest run --config ios/scripts/vitest.config.mjs
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { features } from "../../src/content/features.js";

const target = new URL("../FirstFinder/Resources/Features.json", import.meta.url);
const entries = features.map(({ date, title, description, guide }) => ({ date, title, description, guide: guide || null }));
const expected = JSON.stringify({ features: entries }, null, 2) + "\n";

describe("bundled features", () => {
  it("match src/content/features.js", () => {
    if (process.env.UPDATE) fs.writeFileSync(target, expected);
    expect(fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "").toBe(expected);
  });
});
