// Groups the Features page's entries into month sections, newest month first
// and newest entry first within it. Sorted here rather than trusted from the
// content file's order, so an entry added in the wrong place still lands in
// the right month.

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const dayFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

// Dates are calendar days ("2026-09-08"), so they are read and printed in UTC:
// read in local time, a US browser would show every one a day early.
function parseDay(day) {
  return new Date(`${day}T00:00:00Z`);
}

export function formatFeatureDate(day) {
  return dayFormatter.format(parseDay(day));
}

export function groupFeaturesByMonth(entries) {
  const sorted = [...(entries || [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const groups = [];
  for (const entry of sorted) {
    const key = entry.date.slice(0, 7);
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = { key, label: monthFormatter.format(parseDay(entry.date)), entries: [] };
      groups.push(group);
    }
    group.entries.push(entry);
  }
  return groups;
}
