"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../src/lib/supabaseClient";
import { STATUS, formatPercent } from "../../src/utils/platformLimits";

// How often the page re-reads while you are looking at it.
//
// This is a poll, not a live subscription, and that is a deliberate answer to
// "does this update in realtime". Supabase Realtime enforces RLS through the
// subscribing key, and every table here is owner-only -- an admin subscribing
// from the browser would receive their own rows and nothing else. The service
// role, which can see everything, must never reach the browser. Realtime also
// streams row changes rather than aggregates, so each event would trigger a
// recount anyway. A sixty-second poll of one aggregate query is the same
// answer without the RLS hole.
const POLL_MS = 60000;

// Owns every automatic fetch: the one on mount, the interval, and the catch-up
// when a hidden tab comes back. Keeping all three here rather than splitting
// the mount fetch into its own effect means there is one answer to "when does
// this reload", and no way for the two to disagree.
//
// A backgrounded tab must not keep polling all night for nobody, so the timer
// only runs while the page is actually visible.
function useVisiblePoll(onTick, intervalMs) {
  const savedTick = useRef(onTick);
  const lastRunAt = useRef(0);

  // Synced in an effect rather than assigned during render. The hook has to
  // call the latest closure, but writing a ref in the render phase is a side
  // effect in a place React reserves for pure work. This effect is declared
  // first, so it has always run by the time the one below fires.
  useEffect(() => {
    savedTick.current = onTick;
  }, [onTick]);

  useEffect(() => {
    let timer = null;

    function run() {
      lastRunAt.current = Date.now();
      savedTick.current();
    }

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    function start() {
      stop();
      timer = setInterval(run, intervalMs);
    }

    function onVisibilityChange() {
      if (document.visibilityState !== "visible") {
        stop();
        return;
      }
      // Coming back to a tab that has been hidden for a while: what is on
      // screen was last read before it was hidden. Only catch up if that is
      // actually stale, so flicking away and back does not fire a request for
      // numbers that are two seconds old.
      if (Date.now() - lastRunAt.current >= intervalMs) run();
      start();
    }

    // The first load happens whatever the tab's visibility. Gating this on
    // visible would leave a page opened in a background tab -- or restored by
    // the browser at startup -- showing its loading state indefinitely, and
    // then claiming to be loading while deliberately doing nothing.
    run();
    // The interval is the part worth gating: a hidden tab polling all night
    // costs requests to show nobody anything.
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs]);
}

function relativeTime(iso) {
  if (!iso) return "never";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function shortDate(iso) {
  if (!iso) return "--";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const statusStyles = {
  [STATUS.OK]: { chip: "bg-[#e4efe9] text-[#1c5c4a]", bar: "bg-[#2f7d63]", label: "OK" },
  [STATUS.WATCH]: { chip: "bg-[#f8ecd5] text-[#8a6320]", bar: "bg-[#c99a3c]", label: "Watch" },
  [STATUS.ACT]: { chip: "bg-[#f7e0dc] text-[#8f3524]", bar: "bg-[#b8492f]", label: "Act" }
};

function StatusChip({ status }) {
  const style = statusStyles[status] || statusStyles[STATUS.OK];
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${style.chip}`}>
      {style.label}
    </span>
  );
}

// The primary number is the platform without the maintainer's own account,
// because that is the question being asked. The true total sits underneath in
// smaller type rather than being dropped -- a dashboard that can only show one
// of the two is a dashboard that can mislead you.
function Metric({ label, value, total, hint }) {
  return (
    <div className="rounded-2xl border border-[#e6d9c4] bg-[#fffdf8] p-4">
      <div className="text-xs font-medium uppercase tracking-[0.14em] text-[#8a7a64]">{label}</div>
      <div className="mt-2 text-3xl font-semibold tabular-nums text-[#201a14]">{value}</div>
      {total != null && <div className="mt-1 text-xs text-[#8a7a64]">{total} including your account</div>}
      {hint && <div className="mt-1 text-xs text-[#8a7a64]">{hint}</div>}
    </div>
  );
}

function Section({ title, note, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-[#201a14]">{title}</h2>
      {note && <p className="mt-1 text-sm leading-6 text-[#665746]">{note}</p>}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

function CheckRow({ check }) {
  const style = statusStyles[check.status] || statusStyles[STATUS.OK];
  return (
    <div className="rounded-2xl border border-[#e6d9c4] bg-[#fffdf8] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-[#201a14]">{check.label}</span>
        <StatusChip status={check.status} />
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-2">
        <span className="text-lg font-semibold tabular-nums text-[#201a14]">{check.value}</span>
        {check.ratio != null && <span className="text-sm text-[#8a7a64]">{formatPercent(check.ratio)}</span>}
      </div>
      {check.ratio != null && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#efe4d2]">
          <div
            className={`h-full rounded-full ${style.bar}`}
            style={{ width: `${Math.min(100, Math.max(2, check.ratio * 100))}%` }}
          />
        </div>
      )}
      {check.detail && <p className="mt-2 text-xs leading-5 text-[#8a7a64]">{check.detail}</p>}
      {/* The whole reason this panel exists: not "you are at 91%" but what to
          do about being at 91%. Only rendered when there is something to do. */}
      {check.action && (
        <p className="mt-2 rounded-xl bg-[#f6efe3] px-3 py-2 text-xs leading-5 text-[#4a3f31]">
          <span className="font-semibold">Do this: </span>
          {check.action}
        </p>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState(null);
  // Re-renders the "updated Ns ago" label without refetching, so a stale
  // number never looks fresh just because nothing has moved.
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        setError("Sign in to the app first, then reload this page.");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store"
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error || `Request failed (${response.status}).`);
        setLoading(false);
        return;
      }

      setData(await response.json());
      setFetchedAt(new Date().toISOString());
      setError("");
    } catch (fetchError) {
      // A failed poll must not blank a dashboard that is already showing good
      // numbers -- the stale figures plus an error line are more useful than
      // an empty page.
      setError(fetchError.message || "Could not reach the server.");
    } finally {
      setLoading(false);
    }
  }, []);

  useVisiblePoll(load, POLL_MS);

  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 10000);
    return () => clearInterval(timer);
  }, []);

  const metrics = data?.metrics;
  const checks = data?.checks || [];

  if (loading && !data) {
    return <p className="mt-10 text-sm text-[#665746]">Loading platform metrics…</p>;
  }

  if (error && !data) {
    return (
      <div className="mt-10 rounded-2xl border border-[#e6d9c4] bg-[#fffdf8] p-5">
        <p className="text-sm font-medium text-[#8f3524]">{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-3 rounded-full bg-[#123f38] px-4 py-2 text-sm font-medium text-[#fff7ea] hover:bg-[#0f332d]"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="pb-16">
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e6d9c4] bg-[#fffdf8] px-4 py-3">
        <div className="text-sm text-[#665746]">
          <span className="font-medium text-[#201a14]">Updated {relativeTime(fetchedAt)}</span>
          <span className="ml-2 text-[#8a7a64]">Refreshes every 60s while this tab is open.</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusChip status={data?.status || STATUS.OK} />
          <button
            type="button"
            onClick={load}
            className="rounded-full bg-[#123f38] px-4 py-2 text-sm font-medium text-[#fff7ea] hover:bg-[#0f332d]"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && data && (
        <p className="mt-3 text-sm text-[#8f3524]">Last refresh failed: {error}. Showing the previous numbers.</p>
      )}

      <Section
        title="The platform, without you"
        note={`Every figure below excludes ${data?.excludedAccounts === 1 ? "your own account" : `${data?.excludedAccounts} admin accounts`}, so it answers what other people are doing. The full total is underneath each one.`}
      >
        <Metric
          label="Collectibles"
          value={metrics?.items?.excluding_admins ?? 0}
          total={metrics?.items?.total ?? 0}
          hint={`${metrics?.items?.new_30d ?? 0} added in 30 days`}
        />
        <Metric
          label="Collectors with items"
          value={metrics?.items?.collectors ?? 0}
          hint={`of ${metrics?.users?.excluding_admins ?? 0} signed-up accounts`}
        />
        <Metric
          label="New users (30d)"
          value={metrics?.users?.new_30d ?? 0}
          hint={`${metrics?.users?.new_7d ?? 0} in the last 7 days`}
        />
        <Metric
          label="Signed up, never returned"
          value={metrics?.users?.never_returned ?? 0}
          hint="One sign-in ever"
        />
      </Section>

      <Section
        title="Activity"
        note="Active users come from Supabase's last-sign-in timestamp, which has history behind it. Login counts come from our own table and only count forward from the day it was added."
      >
        <Metric label="Active (7d)" value={metrics?.users?.active_7d ?? 0} hint="Signed in at least once" />
        <Metric label="Active (30d)" value={metrics?.users?.active_30d ?? 0} />
        <Metric
          label="Logins (7d)"
          value={metrics?.logins?.d7 ?? 0}
          hint={
            metrics?.logins?.tracked_since
              ? `Tracked since ${shortDate(metrics.logins.tracked_since)}`
              : "No logins recorded yet"
          }
        />
        <Metric
          label="Shared pages live"
          value={metrics?.shares?.published ?? 0}
          hint={`${metrics?.shares?.started_not_published ?? 0} set up but left off`}
        />
      </Section>

      <Section
        title="Support and cost"
        note="Photo identification is the only feature here billed per call, which is why it is on this page."
      >
        <Metric label="Identify calls today" value={metrics?.identify?.calls_today ?? 0} />
        <Metric label="Identify calls (30d)" value={metrics?.identify?.calls_30d ?? 0} />
        <Metric
          label="Feedback"
          value={metrics?.feedback?.total ?? 0}
          hint={`${metrics?.feedback?.filed_to_github ?? 0} filed as issues${metrics?.feedback?.errored ? `, ${metrics.feedback.errored} failed` : ""}`}
        />
        <Metric
          label="Open issues + PRs"
          value={data?.github?.repo?.openIssuesAndPrs ?? "--"}
          hint={
            data?.github?.repo
              ? `${data.github.repo.stars} ${data.github.repo.stars === 1 ? "star" : "stars"} · pushed ${relativeTime(data.github.repo.lastPushedAt)}`
              : "GitHub unavailable"
          }
        />
      </Section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[#201a14]">Limits</h2>
        <p className="mt-1 text-sm leading-6 text-[#665746]">
          What is close to a wall on the {data?.plan || "free"} plan, and what to do about it. Egress is not shown --
          reading it needs a token with control of every project on the account, which is not worth holding to render a
          progress bar. Check it in the{" "}
          <a
            className="font-medium text-[#123f38] underline underline-offset-4"
            href="https://supabase.com/dashboard/project/_/settings/billing/usage"
            target="_blank"
            rel="noreferrer"
          >
            Supabase usage page
          </a>
          .
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {checks.map((check) => (
            <CheckRow key={check.key} check={check} />
          ))}
          {checks.length === 0 && <p className="text-sm text-[#665746]">No limit checks available.</p>}
        </div>
      </section>
    </div>
  );
}
