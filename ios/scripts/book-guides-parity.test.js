// The book guides' titles, for the phone's book-name suggestions. The guides
// are hand-written content in src/content/books; the phone bundles just the
// fields the suggestion list shows, in ios/FirstFinder/Resources/BookGuides.json.
//
// Run with the other parity checks. It fails when the bundled file has fallen
// behind the guides, and UPDATE=1 rewrites it:
//
//   UPDATE=1 npx vitest run --config ios/scripts/vitest.config.mjs
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import { getAllWorks, workPath } from "../../src/content/books/index.js";

const target = new URL("../FirstFinder/Resources/BookGuides.json", import.meta.url);

const works = getAllWorks().map((work) => ({
  slug: work.slug,
  title: work.title,
  author: work.author || "",
  publisher: work.firstEdition?.publisher || "",
  year: work.firstEdition?.year || null,
  guidePath: workPath(work)
}));
const expected = JSON.stringify({ works }, null, 2) + "\n";

describe("bundled book guides", () => {
  it("match src/content/books", () => {
    if (process.env.UPDATE) fs.writeFileSync(target, expected);
    expect(fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "").toBe(expected);
  });
});
