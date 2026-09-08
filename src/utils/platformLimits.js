// Turns raw platform numbers into "is anything close to a wall, and what do I
// do about it".
//
// The point of this file is the last part. A dashboard that shows "12 MB" has
// told you nothing you can act on -- you still have to remember what the limit
// is, work out the fraction, and decide whether it matters. Every check below
// therefore carries the limit, the resulting status, and the sentence saying
// what to actually do if the status is not ok.
//
// Pure functions with no imports on purpose: this is the part worth testing,
// and it should be testable without a database, a network, or a React tree.

export const STATUS = {
  OK: "ok",
  WATCH: "watch",
  ACT: "act"
};

// 70% is early enough to plan a migration, 90% late enough that it isn't
// crying wolf. Both are about headroom to react, not about the numbers being
// special.
export const WATCH_RATIO = 0.7;
export const ACT_RATIO = 0.9;

// Supabase free-plan allowances.
//
// These are a published price list, not a fact about our database -- Supabase
// changes them without telling us, and a wrong number here is worse than no
// number because it reads as authoritative. Check them against
// https://supabase.com/pricing when something here looks surprising, and note
// that they only apply while the project is on the free plan (the dashboard
// reads the plan from the org and says which plan it is quoting).
//
// Egress is deliberately absent. It is metered per month and is not visible
// from inside Postgres -- the only way to read it is the Management API, which
// needs a personal access token with full control of every project on the
// account. Putting that token in the web app's environment to render a
// progress bar trades a real blast radius for a nice-to-have, so the dashboard
// links out to the Supabase usage page for egress instead of guessing at it.
export const FREE_PLAN = {
  dbBytes: 500 * 1024 * 1024,
  storageBytes: 1024 * 1024 * 1024,
  monthlyActiveUsers: 50000
};

// Free projects are paused after a week without activity. For a project this
// quiet that is a likelier outage than any quota: the app starts returning
// errors, and it takes a manual restore in the dashboard to come back.
export const PAUSE_AFTER_IDLE_DAYS = 7;

// GitHub's own limits, which the API reports rather than us assuming them.
// Kept here so the two GitHub checks read like the Supabase ones.
export const GITHUB_TOKEN_EXPIRY_ACT_DAYS = 7;
export const GITHUB_TOKEN_EXPIRY_WATCH_DAYS = 21;

export function statusFromRatio(ratio) {
  if (!Number.isFinite(ratio)) return STATUS.OK;
  if (ratio >= ACT_RATIO) return STATUS.ACT;
  if (ratio >= WATCH_RATIO) return STATUS.WATCH;
  return STATUS.OK;
}

// Worst-of, so a header can show one badge for the whole panel. Ordered rather
// than compared as strings, because "act" < "ok" < "watch" alphabetically is
// exactly the wrong order.
const SEVERITY = { [STATUS.OK]: 0, [STATUS.WATCH]: 1, [STATUS.ACT]: 2 };

export function worstStatus(checks) {
  return (checks || []).reduce(
    (worst, check) => (SEVERITY[check?.status] > SEVERITY[worst] ? check.status : worst),
    STATUS.OK
  );
}

export function formatBytes(bytes) {
  // Number(null) is 0, so an absent measurement would otherwise render as a
  // confident "0 B" -- "we did not read this" and "this is empty" are
  // different claims, and only one of them is safe to make.
  if (bytes === null || bytes === undefined || bytes === "") return "--";
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) return "--";
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let scaled = value / 1024;
  let unitIndex = 0;
  while (scaled >= 1024 && unitIndex < units.length - 1) {
    scaled /= 1024;
    unitIndex += 1;
  }
  // One decimal below 10 (4.4 GB reads better than 4 GB), none above it.
  return `${scaled >= 10 ? Math.round(scaled) : Math.round(scaled * 10) / 10} ${units[unitIndex]}`;
}

export function formatPercent(ratio) {
  if (!Number.isFinite(ratio)) return "--";
  const percent = ratio * 100;
  // Never round a non-zero usage down to "0%" -- "<1%" is true and is not the
  // same reassurance as "nothing here at all".
  if (percent > 0 && percent < 1) return "<1%";
  return `${Math.round(percent)}%`;
}

export function daysBetween(laterIso, earlierIso) {
  const later = new Date(laterIso).getTime();
  const earlier = new Date(earlierIso).getTime();
  if (!Number.isFinite(later) || !Number.isFinite(earlier)) return null;
  return (later - earlier) / (1000 * 60 * 60 * 24);
}

function quota({ key, label, used, limit, detail, action, format = (n) => Number(n).toLocaleString("en-US") }) {
  const ratio = limit > 0 ? used / limit : NaN;
  const status = statusFromRatio(ratio);
  return {
    key,
    label,
    ratio: Number.isFinite(ratio) ? ratio : null,
    status,
    value: `${format(used)} of ${format(limit)}`,
    detail,
    // Only carried when there is something to do. A row that is fine should
    // read as fine, not as fine-with-a-warning-attached.
    action: status === STATUS.OK ? null : action
  };
}

// Builds every capacity check from one metrics payload. Split out from the
// route so the thresholds can be tested against fabricated numbers -- the
// interesting cases (90% full, project about to pause, token expiring) are all
// states this project has never actually been in.
export function buildPlatformChecks({ capacity = {}, plan = "free", now = new Date(), github = null } = {}) {
  const checks = [];
  const onFreePlan = plan === "free";

  // Quotas are only meaningful against the plan we know the limits for. On a
  // paid plan the allowances are different (and partly usage-billed), so
  // quoting free-plan numbers there would be actively misleading.
  if (onFreePlan) {
    checks.push(
      quota({
        key: "database",
        label: "Database size",
        used: Number(capacity.db_bytes) || 0,
        limit: FREE_PLAN.dbBytes,
        format: formatBytes,
        detail: "Postgres, including indexes and the identify usage history.",
        action:
          "Prune public.identify_usage rows older than 30 days (the cleanup query is in supabase/identify-daily-limit.sql), then consider the Pro plan."
      }),
      quota({
        key: "storage",
        label: "Photo storage",
        used: Number(capacity.storage_bytes) || 0,
        limit: FREE_PLAN.storageBytes,
        format: formatBytes,
        detail: `${Number(capacity.storage_objects) || 0} files in the item-photos bucket.`,
        action:
          "Photos are already compressed to ~200-400KB on upload, so this growing fast means real usage. Move to Pro rather than deleting collectors' photos."
      }),
      quota({
        key: "mau",
        label: "Monthly active users",
        used: Number(capacity.mau_30d) || 0,
        limit: FREE_PLAN.monthlyActiveUsers,
        detail: "Counted across the whole project, including your own account -- this is what Supabase meters.",
        action: "Approaching the free-plan cap is good news. Move to Pro before it lands."
      })
    );
  }

  // The inactivity check, which is the one most likely to actually fire here.
  // Not a quota -- it counts up toward a deadline that any real visit resets --
  // so its ratio is idle time against the pause window.
  if (onFreePlan && capacity.last_activity_at) {
    const idleDays = daysBetween(now, capacity.last_activity_at);
    if (idleDays !== null) {
      const ratio = idleDays / PAUSE_AFTER_IDLE_DAYS;
      const status = statusFromRatio(ratio);
      checks.push({
        key: "pause",
        label: "Free-project pause",
        ratio: Math.min(ratio, 1),
        status,
        value:
          idleDays < 1
            ? "Active today"
            : `Idle ${Math.floor(idleDays)} of ${PAUSE_AFTER_IDLE_DAYS} days`,
        detail: "Free projects pause after a week with no activity, and the app returns errors until it is restored by hand.",
        action:
          status === STATUS.OK
            ? null
            : "Any signed-in visit resets this -- opening the app is enough. If it does pause, restore it from the Supabase dashboard."
      });
    }
  }

  if (github) {
    if (Number.isFinite(github.rateLimit) && github.rateLimit > 0) {
      checks.push(
        quota({
          key: "github-rate",
          label: "GitHub API rate limit",
          used: Number(github.rateUsed) || 0,
          limit: github.rateLimit,
          detail: github.authenticated
            ? "Authenticated, 5,000 an hour. Resets hourly."
            : "Unauthenticated, 60 an hour and shared with anything else on this IP.",
          action: github.authenticated
            ? "The Contribute and admin pages cache their GitHub reads, so this being high suggests something is calling in a loop."
            : "Set GITHUB_TOKEN to raise this from 60 an hour to 5,000."
        })
      );
    }

    // Fine-grained tokens expire, and when this one lapses the feedback-to-
    // issue pipeline stops filing silently -- feedback still saves, it just
    // never reaches GitHub. Exactly the failure mode the Apple client-secret
    // note in .env.example warns about, so it gets a real check.
    if (github.tokenExpiresAt) {
      const daysLeft = daysBetween(github.tokenExpiresAt, now);
      const status =
        daysLeft === null
          ? STATUS.OK
          : daysLeft <= GITHUB_TOKEN_EXPIRY_ACT_DAYS
            ? STATUS.ACT
            : daysLeft <= GITHUB_TOKEN_EXPIRY_WATCH_DAYS
              ? STATUS.WATCH
              : STATUS.OK;
      checks.push({
        key: "github-token",
        label: "GitHub token expiry",
        ratio: null,
        status,
        value: daysLeft === null ? "Unknown" : daysLeft < 0 ? "Expired" : `${Math.floor(daysLeft)} days left`,
        detail: "Files feedback as issues and raises the API rate limit.",
        action:
          status === STATUS.OK
            ? null
            : "Issue a new fine-grained token (Issues: Read and write on this repo) and update GITHUB_TOKEN. Feedback is saved either way, but stops reaching GitHub."
      });
    }
  }

  return checks;
}
