// The dashboard's figures, computed twice -- by the web's own src/utils and by
// the iOS port -- on the same sample collection, under every category and
// period filter, and compared. The Swift half is WebParityExport in
// FirstFinderTests, which writes ios/build/parity/dashboard.json:
//
//   (run the iOS tests first, then)
//   npx vitest run --config ios/scripts/vitest.config.mjs
//
// Not part of npm test: it needs that file, which only an Xcode run makes.
import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import { applyDashboardFilters, monthlyBuckets, recentFinds } from "../../src/utils/dashboard.js";
import { itemValueForTotals } from "../../src/utils/items.js";
import { formatCurrency, toNumber } from "../../src/utils/format.js";

const swift = JSON.parse(fs.readFileSync(new URL("../build/parity/dashboard.json", import.meta.url), "utf8"));

// The web's DashboardPage, computed the way it computes them.
function webFigures(inventory, category, range) {
  const { visible, undatedExcluded } = applyDashboardFilters(inventory, category, range);
  const sold = visible.filter((item) => item.status === "Sold");
  const held = visible.filter((item) => item.status !== "Sold");
  const topHeld = held.reduce((best, item) => (toNumber(item.estimatedValue) > toNumber(best?.estimatedValue ?? 0) ? item : best), null);
  const topSold = sold.reduce((best, item) => (toNumber(item.soldPrice) > toNumber(best?.soldPrice ?? 0) ? item : best), null);
  const totalHeld = held.reduce((sum, item) => { const v = itemValueForTotals(item); return v === null ? sum : sum + v; }, 0);
  const totalSold = sold.reduce((sum, item) => sum + toNumber(item.soldPrice), 0);
  const bucket = (b) => `${b.key}:${b.count}:${b.amount}`;
  return {
    category, range, visible: visible.length, undatedExcluded, held: held.length, sold: sold.length,
    categoryCount: new Set(held.map((i) => i.category).filter(Boolean)).size,
    totalHeld: formatCurrency(totalHeld),
    topHeld: topHeld ? `${topHeld.name} ${formatCurrency(topHeld.estimatedValue)}` : "—",
    totalSold: formatCurrency(totalSold),
    topSold: topSold ? `${topSold.name} ${formatCurrency(topSold.soldPrice)}` : "—",
    acquisitions: monthlyBuckets(visible, "purchaseDate", "purchasePrice").map(bucket),
    sales: monthlyBuckets(sold, "soldDate", "soldPrice").map(bucket),
    recent: recentFinds(visible, 20).map((i) => i.id)
  };
}

describe("dashboard parity: web utils vs the Swift port, on the sample collection", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(swift.now));
  for (const expected of swift.figures) {
    it(`${expected.category || "all categories"} / ${expected.range}`, () => {
      expect(expected).toEqual(webFigures(swift.items, expected.category, expected.range));
    });
  }
});
