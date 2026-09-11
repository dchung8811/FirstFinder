// The health of the machine Postgres is running on, as opposed to how full it
// is.
//
// platformLimits.js answers "how much of the plan's allowance is spent", which
// is a question about quotas and grows in one direction. This file answers
// "is the instance struggling right now", which is a different question with
// different thresholds: a database sitting at 56% memory is healthy and always
// will be, where a bucket at 56% of its quota is half gone.
//
// The numbers come from the project's own Prometheus endpoint, so nothing here
// needs the Management API -- see the note on the Management API in
// platformLimits.js for why that distinction was worth keeping.
//
// Pure, so the parsing and the thresholds can be tested against fabricated
// scrapes. The fetch lives in src/lib/computeMetrics.js.

import { STATUS } from "./platformLimits";

// Deliberately not the 70/90 used for quotas.
//
// Postgres claims memory and holds it: shared_buffers is reserved at startup
// whether or not it is in use, and the OS caches data files on top. An
// instance resting at 60-70% is behaving exactly as designed, and warning
// about it would train the reader to ignore the panel. Only genuine pressure
// is worth a colour.
export const MEMORY_WATCH_RATIO = 0.85;
export const MEMORY_ACT_RATIO = 0.95;

// Sustained CPU is the signal; brief spikes are not. See the note on
// cpuSinceBoot below for why this reads an average rather than a moment.
export const CPU_WATCH_RATIO = 0.7;
export const CPU_ACT_RATIO = 0.9;

// Disk and connections do behave like quotas -- both are a fixed ceiling you
// can genuinely run into -- so these match platformLimits.
export const DISK_WATCH_RATIO = 0.7;
export const DISK_ACT_RATIO = 0.9;
export const CONNECTION_WATCH_RATIO = 0.7;
export const CONNECTION_ACT_RATIO = 0.9;

// The volume Postgres actually writes to. Matched on the label rather than by
// position: the scrape also carries the root filesystem, and they are not
// interchangeable.
export const DATA_MOUNTPOINT = 'mountpoint="/data"';

function statusFrom(ratio, watch, act) {
  if (!Number.isFinite(ratio)) return STATUS.OK;
  if (ratio >= act) return STATUS.ACT;
  if (ratio >= watch) return STATUS.WATCH;
  return STATUS.OK;
}

// One gauge whose labels contain a given fragment. Needed wherever a metric
// has several series and only one of them is the answer.
export function readLabelledGauge(text, name, labelFilter) {
  const pattern = new RegExp(`^${name}\\{([^}]*)\\}\\s+([0-9eE.+-]+)\\s*$`, "gm");

  for (let match = pattern.exec(text || ""); match; match = pattern.exec(text || "")) {
    if (!match[1].includes(labelFilter)) continue;
    const value = Number(match[2]);
    if (Number.isFinite(value)) return value;
  }

  return null;
}

// One gauge, by name, ignoring labels. Prometheus writes values in scientific
// notation (4.28224512e+08), which Number handles.
export function readGauge(text, name) {
  const match = new RegExp(`^${name}(?:\\{[^}]*\\})?\\s+([0-9eE.+-]+)\\s*$`, "m").exec(text || "");
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

// Every series sharing a name, summed. Used for per-core and per-mode counters
// where the total is what matters.
export function sumSeries(text, name, labelFilter = null) {
  const pattern = new RegExp(`^${name}(?:\\{([^}]*)\\})?\\s+([0-9eE.+-]+)\\s*$`, "gm");
  let total = null;

  for (let match = pattern.exec(text || ""); match; match = pattern.exec(text || "")) {
    const labels = match[1] || "";
    if (labelFilter && !labels.includes(labelFilter)) continue;
    const value = Number(match[2]);
    if (!Number.isFinite(value)) continue;
    total = (total || 0) + value;
  }

  return total;
}

// Turns one scrape into the handful of numbers worth showing.
//
// Every field is null rather than 0 when the scrape did not carry it. "We did
// not read this" and "this is zero" are different claims, and the formatting
// helpers in platformLimits already rely on that distinction.
export function parseComputeMetrics(text) {
  const memTotal = readGauge(text, "node_memory_MemTotal_bytes");
  const memAvailable = readGauge(text, "node_memory_MemAvailable_bytes");

  // Pinned to the data volume by mountpoint, because the instance reports
  // more than one filesystem and only this one is about the database. The
  // other is the OS image, which runs around 80% full as a matter of course
  // and is not the operator's to manage -- reading whichever came first in
  // the scrape showed 80% and raised a warning about somebody else's disk.
  const diskSize = readLabelledGauge(text, "node_filesystem_size_bytes", DATA_MOUNTPOINT);
  const diskAvail = readLabelledGauge(text, "node_filesystem_avail_bytes", DATA_MOUNTPOINT);

  // Counters, in seconds since the instance booted. A single scrape cannot
  // say what the CPU is doing this minute -- that needs two scrapes and a
  // subtraction. What it can say honestly is the average since boot, which is
  // what a long-running problem shows up in, so that is what this reports and
  // what the label says. Anything else would be inventing precision.
  const cpuAll = sumSeries(text, "node_cpu_seconds_total");
  const cpuIdle = sumSeries(text, "node_cpu_seconds_total", 'mode="idle"');

  const connections = sumSeries(text, "connection_stats_connection_count");
  const maxConnections = readGauge(text, "max_connections_connection_count");

  return {
    memory:
      memTotal && memAvailable !== null
        ? { usedBytes: memTotal - memAvailable, totalBytes: memTotal, ratio: 1 - memAvailable / memTotal }
        : null,
    disk:
      diskSize && diskAvail !== null
        ? { usedBytes: diskSize - diskAvail, totalBytes: diskSize, ratio: 1 - diskAvail / diskSize }
        : null,
    cpuSinceBoot:
      cpuAll && cpuIdle !== null && cpuAll > 0 ? { busyRatio: 1 - cpuIdle / cpuAll, cores: readGauge(text, "node_cpu_online") } : null,
    connections:
      connections !== null && maxConnections
        ? { current: connections, max: maxConnections, ratio: connections / maxConnections }
        : null
  };
}

// The same shape buildPlatformChecks returns, so the dashboard renders these
// through the row component it already has.
export function buildComputeChecks(metrics) {
  if (!metrics) return [];
  const checks = [];

  if (metrics.memory) {
    const status = statusFrom(metrics.memory.ratio, MEMORY_WATCH_RATIO, MEMORY_ACT_RATIO);
    checks.push({
      key: "compute-memory",
      label: "Instance memory",
      ratio: metrics.memory.ratio,
      status,
      value: `${Math.round(metrics.memory.ratio * 100)}% in use`,
      detail:
        "Postgres reserves shared buffers at startup and the OS caches data files on top, so a healthy instance rests well above half.",
      action:
        status === STATUS.OK
          ? null
          : "Sustained pressure this high means queries are spilling to disk. Check the slow queries below, then consider a larger compute add-on."
    });
  }

  if (metrics.cpuSinceBoot) {
    const status = statusFrom(metrics.cpuSinceBoot.busyRatio, CPU_WATCH_RATIO, CPU_ACT_RATIO);
    checks.push({
      key: "compute-cpu",
      label: "CPU since restart",
      ratio: metrics.cpuSinceBoot.busyRatio,
      status,
      value: `${Math.round(metrics.cpuSinceBoot.busyRatio * 100)}% busy`,
      // Said plainly rather than dressed up as a live reading: one scrape of a
      // counter is an average, and the Supabase dashboard's own CPU graph is
      // the place to look at the last hour.
      detail: `Averaged over the whole uptime of the instance, across ${metrics.cpuSinceBoot.cores || 1} core${metrics.cpuSinceBoot.cores === 1 ? "" : "s"} -- not a reading of this moment.`,
      action: status === STATUS.OK ? null : "Look at the slow queries below before adding compute; a missing index is the cheaper fix."
    });
  }

  if (metrics.disk) {
    const status = statusFrom(metrics.disk.ratio, DISK_WATCH_RATIO, DISK_ACT_RATIO);
    checks.push({
      key: "compute-disk",
      label: "Instance disk",
      ratio: metrics.disk.ratio,
      status,
      value: `${Math.round(metrics.disk.ratio * 100)}% used`,
      // Worth separating from the database-size quota above it, which counts
      // table data against the plan. This is the volume, including the
      // write-ahead log and indexes, and it fills sooner.
      detail: "The whole volume, including the write-ahead log and indexes -- larger than the database size quota above.",
      action: status === STATUS.OK ? null : "Postgres degrades badly on a full disk. Add disk before this reaches the top."
    });
  }

  if (metrics.connections) {
    const status = statusFrom(metrics.connections.ratio, CONNECTION_WATCH_RATIO, CONNECTION_ACT_RATIO);
    checks.push({
      key: "compute-connections",
      label: "Database connections",
      ratio: metrics.connections.ratio,
      status,
      value: `${Math.round(metrics.connections.current)} of ${Math.round(metrics.connections.max)}`,
      detail: "Browsers reach Postgres through a pooler, so this grows with traffic rather than with signed-in collectors.",
      action:
        status === STATUS.OK
          ? null
          : "Connections exhausting is an outage, not a slowdown. Check for a client opening connections without closing them."
    });
  }

  return checks;
}
