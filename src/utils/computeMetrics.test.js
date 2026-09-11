import { describe, it, expect } from "vitest";
import { STATUS } from "./platformLimits";
import {
  readGauge,
  sumSeries,
  parseComputeMetrics,
  buildComputeChecks,
  MEMORY_WATCH_RATIO,
  MEMORY_ACT_RATIO
} from "./computeMetrics";

// A trimmed scrape in the real format, including the scientific notation and
// the project labels the endpoint actually emits.
const LABELS = '{supabase_project_ref="abc",service_type="db"}';
const SCRAPE = `
# HELP node_memory_MemTotal_bytes Total memory
node_memory_MemTotal_bytes${LABELS} 4.28224512e+08
node_memory_MemAvailable_bytes${LABELS} 1.8921472e+08
node_filesystem_size_bytes{mountpoint="/",device="/dev/nvme0n1p2"} 1.036e+10
node_filesystem_avail_bytes{mountpoint="/",device="/dev/nvme0n1p2"} 2.12e+09
node_filesystem_size_bytes{mountpoint="/data",device="/dev/nvme1n1"} 2.08e+09
node_filesystem_avail_bytes{mountpoint="/data",device="/dev/nvme1n1"} 1.78e+09
node_cpu_seconds_total{mode="idle",cpu="0"} 980
node_cpu_seconds_total{mode="user",cpu="0"} 15
node_cpu_seconds_total{mode="system",cpu="0"} 5
node_cpu_online${LABELS} 1
connection_stats_connection_count{state="active"} 4
connection_stats_connection_count{state="idle"} 10
max_connections_connection_count${LABELS} 60
`.trim();

describe("readGauge", () => {
  it("reads a value through its labels", () => {
    expect(readGauge(SCRAPE, "node_memory_MemTotal_bytes")).toBe(428224512);
  });

  it("handles scientific notation, which is how these arrive", () => {
    expect(readGauge(SCRAPE, "node_memory_MemAvailable_bytes")).toBe(189214720);
  });

  // readGauge ignores labels and takes the first match, which is fine for a
  // metric with one series and wrong for one with several -- hence
  // readLabelledGauge, and hence the filesystem reading not using this.
  it("takes the first series when a name has several", () => {
    expect(readGauge(SCRAPE, "node_filesystem_size_bytes")).toBe(1.036e10);
  });

  // Absent and zero are different claims -- the formatters downstream depend
  // on being able to tell them apart.
  it("returns null for a metric the scrape does not carry", () => {
    expect(readGauge(SCRAPE, "node_nothing_here")).toBe(null);
    expect(readGauge("", "node_memory_MemTotal_bytes")).toBe(null);
    expect(readGauge(null, "node_memory_MemTotal_bytes")).toBe(null);
  });

  it("does not match a metric whose name merely starts the same", () => {
    expect(readGauge("node_cpu_online_extra 5", "node_cpu_online")).toBe(null);
  });
});

describe("sumSeries", () => {
  it("adds every series sharing a name", () => {
    expect(sumSeries(SCRAPE, "node_cpu_seconds_total")).toBe(1000);
  });

  it("can restrict to one label", () => {
    expect(sumSeries(SCRAPE, "node_cpu_seconds_total", 'mode="idle"')).toBe(980);
  });

  it("sums the connection counts across their states", () => {
    expect(sumSeries(SCRAPE, "connection_stats_connection_count")).toBe(14);
  });

  it("returns null rather than 0 when nothing matched", () => {
    expect(sumSeries(SCRAPE, "node_absent_total")).toBe(null);
  });
});

describe("parseComputeMetrics", () => {
  const parsed = parseComputeMetrics(SCRAPE);

  it("reads memory as used against total", () => {
    expect(Math.round(parsed.memory.ratio * 100)).toBe(56);
    expect(parsed.memory.totalBytes).toBe(428224512);
  });

  // The regression this test exists for. A real instance reports the OS image
  // (~80% full as a matter of course) alongside the data volume, and reading
  // whichever came first warned about a disk the operator does not manage.
  it("reads the data volume, not the root filesystem beside it", () => {
    expect(Math.round(parsed.disk.ratio * 100)).toBe(14);
    expect(parsed.disk.totalBytes).toBe(2.08e9);
  });

  // One scrape of a counter is an average since boot, not a live reading. The
  // label on the check says so; this just confirms the arithmetic.
  it("derives CPU busy time from idle against total", () => {
    expect(Math.round(parsed.cpuSinceBoot.busyRatio * 100)).toBe(2);
    expect(parsed.cpuSinceBoot.cores).toBe(1);
  });

  it("reads connections against the configured maximum", () => {
    expect(parsed.connections).toEqual({ current: 14, max: 60, ratio: 14 / 60 });
  });

  // A scrape that is missing a family must not produce a confident zero.
  it("returns null sections rather than inventing numbers", () => {
    const empty = parseComputeMetrics("# nothing useful here");
    expect(empty.memory).toBe(null);
    expect(empty.disk).toBe(null);
    expect(empty.cpuSinceBoot).toBe(null);
    expect(empty.connections).toBe(null);
  });

  it("survives junk without throwing", () => {
    expect(() => parseComputeMetrics("")).not.toThrow();
    expect(() => parseComputeMetrics(null)).not.toThrow();
  });
});

describe("buildComputeChecks", () => {
  it("produces nothing at all when there are no metrics", () => {
    expect(buildComputeChecks(null)).toEqual([]);
    expect(buildComputeChecks({})).toEqual([]);
  });

  it("builds a row for each reading the scrape carried", () => {
    const keys = buildComputeChecks(parseComputeMetrics(SCRAPE)).map((c) => c.key);
    expect(keys).toEqual(["compute-memory", "compute-cpu", "compute-disk", "compute-connections"]);
  });

  it("omits a row whose reading was missing, rather than showing a blank one", () => {
    const partial = parseComputeMetrics("node_memory_MemTotal_bytes 100\nnode_memory_MemAvailable_bytes 40");
    expect(buildComputeChecks(partial).map((c) => c.key)).toEqual(["compute-memory"]);
  });

  // The point of separate thresholds. A database resting at 56% memory is
  // behaving exactly as designed, and a warning there would teach the reader
  // to ignore the panel.
  it("treats ordinary Postgres memory use as fine", () => {
    const [memory] = buildComputeChecks(parseComputeMetrics(SCRAPE));
    expect(memory.status).toBe(STATUS.OK);
    expect(memory.action).toBe(null);
  });

  it("warns only once memory is genuinely under pressure", () => {
    const at = (ratio) =>
      buildComputeChecks({ memory: { ratio, usedBytes: ratio * 100, totalBytes: 100 } })[0].status;
    expect(at(MEMORY_WATCH_RATIO - 0.01)).toBe(STATUS.OK);
    expect(at(MEMORY_WATCH_RATIO)).toBe(STATUS.WATCH);
    expect(at(MEMORY_ACT_RATIO)).toBe(STATUS.ACT);
  });

  it("carries an action only when there is something to do", () => {
    const [pressured] = buildComputeChecks({ memory: { ratio: 0.97, usedBytes: 97, totalBytes: 100 } });
    expect(pressured.status).toBe(STATUS.ACT);
    expect(pressured.action).toBeTruthy();
  });

  it("counts a nearly exhausted connection pool as needing action", () => {
    const [conns] = buildComputeChecks({ connections: { current: 57, max: 60, ratio: 57 / 60 } });
    expect(conns.status).toBe(STATUS.ACT);
    expect(conns.value).toBe("57 of 60");
  });
});
