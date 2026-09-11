// Reads the project's own Prometheus endpoint.
//
// Deliberately not the Management API. That needs a personal access token with
// control of every project on the account, which platformLimits.js already
// declined to put in this app's environment for the sake of a progress bar.
// This endpoint is scoped to one project and authenticates with the service
// role key the server already holds, so it adds no new blast radius.
//
// Server-only: the key must never reach a browser. It is imported by the admin
// stats route, which is already behind requireAdmin.

import { parseComputeMetrics } from "../utils/computeMetrics";

// The scrape is ~600KB of text, most of it metrics this app has no use for.
// Fetched only when an admin loads the dashboard, which is rare enough that
// parsing the lot is cheaper than maintaining a filter.
const METRICS_PATH = "/customer/v1/privileged/metrics";

// Long enough for a cold instance, short enough that a hanging endpoint does
// not hold the whole dashboard hostage -- every other panel still renders.
const TIMEOUT_MS = 5000;

export async function readComputeMetrics() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${url}${METRICS_PATH}`, {
      // Basic auth with the literal username "service_role" is what this
      // endpoint expects; the password is the service key.
      headers: { Authorization: `Basic ${Buffer.from(`service_role:${key}`).toString("base64")}` },
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      console.error("Compute metrics error:", response.status);
      return null;
    }

    return parseComputeMetrics(await response.text());
  } catch (error) {
    // Null, not a throw. These are a nice-to-have on a panel whose other
    // numbers come from Postgres: an unreachable metrics endpoint should cost
    // four rows, not the whole dashboard.
    console.error("Compute metrics error:", error.name === "AbortError" ? "timed out" : error.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
