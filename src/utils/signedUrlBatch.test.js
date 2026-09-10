import { describe, it, expect, vi } from "vitest";
import { createSignedUrlBatcher, BATCH_WINDOW_MS } from "./signedUrlBatch";

// Answers whatever it was asked for, and records each call so the tests can
// assert on how many trips were made rather than only on what came back.
function recordingFetch(urlFor = (path) => `signed:${path}`) {
  const calls = [];
  const fetchBatch = (paths) => {
    calls.push(paths);
    return Promise.resolve(paths.map((path) => ({ path, url: urlFor(path) })));
  };
  return { fetchBatch, calls };
}

describe("createSignedUrlBatcher", () => {
  // The whole point. Every photo on the page notices its URL has expired in
  // the same second, because they were all signed in the same second.
  it("turns a burst of requests into one fetch", async () => {
    const { fetchBatch, calls } = recordingFetch();
    const request = createSignedUrlBatcher(fetchBatch, { windowMs: 1 });

    const results = await Promise.all([request("a.jpg"), request("b.jpg"), request("c.jpg")]);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
    expect(results).toEqual(["signed:a.jpg", "signed:b.jpg", "signed:c.jpg"]);
  });

  it("gives every caller its own url, not the first one's", async () => {
    const { fetchBatch } = recordingFetch((path) => `url-for-${path}`);
    const request = createSignedUrlBatcher(fetchBatch, { windowMs: 1 });

    const [first, second] = await Promise.all([request("one.jpg"), request("two.jpg")]);

    expect(first).toBe("url-for-one.jpg");
    expect(second).toBe("url-for-two.jpg");
  });

  // Two photos of the same file is an ordinary thing on a page -- a thumbnail
  // and the same shot open in the viewer.
  it("asks once for a path two callers want, and answers both", async () => {
    const { fetchBatch, calls } = recordingFetch();
    const request = createSignedUrlBatcher(fetchBatch, { windowMs: 1 });

    const results = await Promise.all([request("same.jpg"), request("same.jpg")]);

    expect(calls[0]).toEqual(["same.jpg"]);
    expect(results).toEqual(["signed:same.jpg", "signed:same.jpg"]);
  });

  it("starts a fresh batch once the last one has gone", async () => {
    const { fetchBatch, calls } = recordingFetch();
    const request = createSignedUrlBatcher(fetchBatch, { windowMs: 1 });

    await request("first.jpg");
    await request("second.jpg");

    expect(calls).toEqual([["first.jpg"], ["second.jpg"]]);
  });

  // A request landing while a batch is in flight must not be dropped into one
  // that has already been sent.
  it("does not lose a request that arrives mid-flight", async () => {
    const calls = [];
    let releaseFirst;
    const fetchBatch = (paths) => {
      calls.push(paths);
      if (calls.length === 1) {
        return new Promise((resolve) => {
          releaseFirst = () => resolve(paths.map((path) => ({ path, url: `signed:${path}` })));
        });
      }
      return Promise.resolve(paths.map((path) => ({ path, url: `signed:${path}` })));
    };

    const request = createSignedUrlBatcher(fetchBatch, { windowMs: 1 });
    const inFlight = request("early.jpg");
    await new Promise((resolve) => setTimeout(resolve, 5));

    const late = request("late.jpg");
    releaseFirst();

    expect(await inFlight).toBe("signed:early.jpg");
    expect(await late).toBe("signed:late.jpg");
    expect(calls).toEqual([["early.jpg"], ["late.jpg"]]);
  });

  // A caller left hanging would strand its photo mid-load, with no failed
  // state and nothing to retry -- worse than the failure being reported.
  it("answers everyone with a blank when the fetch rejects", async () => {
    const failing = () => Promise.reject(new Error("network is gone"));
    const request = createSignedUrlBatcher(failing, { windowMs: 1 });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const results = await Promise.all([request("a.jpg"), request("b.jpg")]);

    expect(results).toEqual(["", ""]);
    spy.mockRestore();
  });

  it("answers with a blank for a path the batch did not come back with", async () => {
    const partial = (paths) => Promise.resolve(paths.filter((path) => path !== "missing.jpg").map((path) => ({ path, url: `signed:${path}` })));
    const request = createSignedUrlBatcher(partial, { windowMs: 1 });

    const [found, missing] = await Promise.all([request("here.jpg"), request("missing.jpg")]);

    expect(found).toBe("signed:here.jpg");
    expect(missing).toBe("");
  });

  it("survives a malformed response without throwing", async () => {
    const junk = () => Promise.resolve([null, { url: "no path" }, undefined]);
    const request = createSignedUrlBatcher(junk, { windowMs: 1 });

    expect(await request("a.jpg")).toBe("");
  });

  it("never asks for a blank path", async () => {
    const { fetchBatch, calls } = recordingFetch();
    const request = createSignedUrlBatcher(fetchBatch, { windowMs: 1 });

    expect(await request("")).toBe("");
    expect(await request(undefined)).toBe("");
    expect(calls).toEqual([]);
  });

  it("defaults to a window short enough to go unnoticed", () => {
    expect(BATCH_WINDOW_MS).toBeLessThanOrEqual(100);
  });
});
