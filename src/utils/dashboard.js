// Dashboard bucketing and filtering.
//
// applyDashboardFilters reports how many items it dropped for having no date,
// because silently excluding them would make the totals look wrong for no
// visible reason.

import { toNumber } from "./format";

export const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthLabel(key) {
  const [year, month] = key.split("-");
  return `${monthNames[Number(month) - 1]} ${year.slice(2)}`;
}

// Buckets items by month on a given date field, filling in the months where
// nothing happened. Empty months matter: collapsing them would turn an
// 18-month gap into a single tick and misrepresent the pace of collecting.
export function monthlyBuckets(items, dateField, amountField) {
  const rows = items
    .filter((item) => /^\d{4}-\d{2}/.test(String(item[dateField] || "")))
    .map((item) => ({ key: String(item[dateField]).slice(0, 7), amount: toNumber(item[amountField]) }));

  if (rows.length === 0) return [];

  const sorted = rows.map((row) => row.key).sort();
  let [year, month] = sorted[0].split("-").map(Number);
  const [lastYear, lastMonth] = sorted[sorted.length - 1].split("-").map(Number);

  const buckets = [];
  while ((year < lastYear || (year === lastYear && month <= lastMonth)) && buckets.length < 360) {
    buckets.push({ key: `${year}-${String(month).padStart(2, "0")}`, count: 0, amount: 0 });
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }

  const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));
  rows.forEach((row) => {
    const bucket = byKey.get(row.key);
    if (!bucket) return;
    bucket.count += 1;
    bucket.amount += row.amount;
  });

  return buckets;
}

// Dashboard filters ---------------------------------------------------------

export const dashboardRanges = [
  { key: "all", label: "All time", months: null },
  { key: "12m", label: "Last 12 months", months: 12 },
  { key: "3m", label: "Last 3 months", months: 3 },
  { key: "ytd", label: "This year", months: null, yearToDate: true }
];

// Which date a range filter should judge an item by. A sold item belongs to the
// period it sold in; anything still held belongs to the period it was acquired.
// That is what makes "this year" read as "what I did this year" across every
// panel on the page rather than meaning different things in different charts.
export function dashboardDateFor(item) {
  return item.status === "Sold" ? item.soldDate : item.purchaseDate;
}

export function dashboardRangeStart(rangeKey) {
  const range = dashboardRanges.find((entry) => entry.key === rangeKey);
  if (!range || (!range.months && !range.yearToDate)) return null;

  const now = new Date();
  if (range.yearToDate) return new Date(now.getFullYear(), 0, 1);

  const start = new Date(now);
  start.setMonth(start.getMonth() - range.months);
  return start;
}

// Returns the filtered items plus how many were dropped for having no date at
// all. Undated items genuinely cannot belong to "this year", but silently
// removing them would make the totals look wrong for no visible reason, so the
// count gets surfaced.
export function applyDashboardFilters(inventory, category, rangeKey) {
  const byCategory = category === "" ? inventory : inventory.filter((item) => item.category === category);
  const start = dashboardRangeStart(rangeKey);
  if (!start) return { visible: byCategory, undatedExcluded: 0 };

  let undatedExcluded = 0;
  const visible = byCategory.filter((item) => {
    const raw = dashboardDateFor(item);
    if (!/^\d{4}-\d{2}/.test(String(raw || ""))) {
      undatedExcluded += 1;
      return false;
    }
    return new Date(raw) >= start;
  });

  return { visible, undatedExcluded };
}
