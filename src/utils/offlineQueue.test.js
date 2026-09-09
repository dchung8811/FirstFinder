import { describe, it, expect } from "vitest";
import {
  MAX_ATTEMPTS,
  PENDING_ID_PREFIX,
  isPendingId,
  newPendingId,
  createOperation,
  updateOperation,
  deleteOperation,
  enqueue,
  applyQueueToCollection,
  isBlocked,
  markAttempt,
  summarizeQueue,
  describeOperation,
  queueLabel
} from "./offlineQueue";

const USER = "11111111-1111-1111-1111-111111111111";
const AT = "2026-09-09T10:00:00.000Z";

const create = (over = {}) =>
  createOperation({
    userId: USER,
    item: { id: newPendingId("a"), name: "Dune", author: "Frank Herbert", category: "Book", status: "Owned", ...(over.item || {}) },
    itemPhotoCount: over.itemPhotoCount || 0,
    at: AT,
    id: over.id || "op-1"
  });

const update = (itemId, fields, id = "op-2") => updateOperation({ userId: USER, itemId, fields, at: AT, id });
const remove = (itemId, id = "op-3") => deleteOperation({ userId: USER, itemId, name: "Dune", at: AT, id });

const row = (over = {}) => ({ id: "row-1", name: "East of Eden", author: "John Steinbeck", category: "Book", status: "Owned", ...over });

describe("pending ids", () => {
  // A pending id is not a uuid. The prefix is what makes a mistake fail here
  // rather than quietly in Postgres.
  it("marks and recognises an id that exists only on the device", () => {
    expect(newPendingId("abc")).toBe(`${PENDING_ID_PREFIX}abc`);
    expect(isPendingId(newPendingId("abc"))).toBe(true);
    expect(isPendingId("11111111-1111-1111-1111-111111111111")).toBe(false);
    expect(isPendingId(undefined)).toBe(false);
  });
});

describe("enqueue collapsing", () => {
  it("appends an operation with nothing to collapse against", () => {
    const { queue, stored } = enqueue([], create());
    expect(queue).toHaveLength(1);
    expect(stored.kind).toBe("create");
  });

  // The row does not exist server-side yet, so an update against its id could
  // not be sent at all -- it has to fold into the create.
  it("folds an edit of an unsent item into its create", () => {
    const first = create();
    const { queue } = enqueue([first], update(first.itemId, { name: "Dune (first)", condition: "Fair" }));
    expect(queue).toHaveLength(1);
    expect(queue[0].kind).toBe("create");
    expect(queue[0].fields.name).toBe("Dune (first)");
    expect(queue[0].fields.condition).toBe("Fair");
    expect(queue[0].fields.author).toBe("Frank Herbert");
  });

  it("drops both when an unsent item is deleted before it ever syncs", () => {
    const first = create();
    const { queue, stored, removedIds } = enqueue([first], remove(first.itemId));
    expect(queue).toEqual([]);
    expect(stored).toBe(null);
    expect(removedIds).toEqual([first.id]);
  });

  it("drops the edits too when an unsent item is deleted", () => {
    const first = create();
    const withEdit = enqueue([first], update(first.itemId, { condition: "Poor" })).queue;
    const { queue, removedIds } = enqueue(withEdit, remove(first.itemId));
    expect(queue).toEqual([]);
    expect(removedIds).toEqual([first.id]);
  });

  it("merges repeated edits of the same row, later field winning", () => {
    const one = enqueue([], update("row-1", { condition: "Fair", notes: "chipped" })).queue;
    const { queue } = enqueue(one, update("row-1", { condition: "Poor" }, "op-9"));
    expect(queue).toHaveLength(1);
    expect(queue[0].id).toBe("op-2");
    expect(queue[0].fields).toEqual({ condition: "Poor", notes: "chipped" });
  });

  it("keeps edits of different rows apart", () => {
    const one = enqueue([], update("row-1", { condition: "Fair" })).queue;
    const { queue } = enqueue(one, update("row-2", { condition: "Poor" }, "op-9"));
    expect(queue).toHaveLength(2);
  });

  // Sending the edit first would be a write that can fail on its own, for a
  // row that is about to be gone.
  it("replaces a pending edit with the delete that followed it", () => {
    const one = enqueue([], update("row-1", { condition: "Fair" })).queue;
    const { queue, removedIds } = enqueue(one, remove("row-1"));
    expect(queue).toHaveLength(1);
    expect(queue[0].kind).toBe("delete");
    expect(removedIds).toEqual(["op-2"]);
  });

  it("keeps a merged edit's failure history rather than starting it over", () => {
    const failed = markAttempt(update("row-1", { condition: "Fair" }), "network");
    const { queue } = enqueue([failed], update("row-1", { notes: "second try" }, "op-9"));
    expect(queue[0].attempts).toBe(1);
    expect(queue[0].fields).toEqual({ condition: "Fair", notes: "second try" });
    // The error is cleared: it describes a send that is about to be retried
    // with more in it.
    expect(queue[0].lastError).toBe("");
  });
});

describe("applyQueueToCollection", () => {
  it("leaves the collection alone when nothing is queued", () => {
    expect(applyQueueToCollection([row()], [])).toEqual([row()]);
    expect(applyQueueToCollection(undefined, undefined)).toEqual([]);
  });

  // The whole point: a find added in a basement must not vanish when a refetch
  // succeeds, or the collector adds it twice.
  it("shows an unsent item at the top of the shelf, marked pending", () => {
    const op = create();
    const result = applyQueueToCollection([row()], [op]);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Dune");
    expect(result[0].pendingSync).toBe(true);
    expect(result[0].id).toBe(op.itemId);
    expect(result[1].pendingSync).toBeUndefined();
  });

  it("carries the photo counts of an unsent item without its blobs", () => {
    const op = create({ itemPhotoCount: 3 });
    const [pending] = applyQueueToCollection([], [op]);
    expect(pending.itemPhotoCount).toBe(3);
    expect(pending.itemPhotos).toEqual([]);
  });

  it("applies a queued edit over the server's copy", () => {
    const result = applyQueueToCollection([row()], [update("row-1", { condition: "Fair" })]);
    expect(result[0].condition).toBe("Fair");
    expect(result[0].pendingSync).toBe(true);
  });

  it("hides a row whose delete is still waiting", () => {
    expect(applyQueueToCollection([row()], [remove("row-1")])).toEqual([]);
  });

  it("applies operations in order, newest addition first", () => {
    const older = create({ id: "op-a", item: { id: newPendingId("a"), name: "First find" } });
    const newer = create({ id: "op-b", item: { id: newPendingId("b"), name: "Second find" } });
    const names = applyQueueToCollection([row()], [older, newer]).map((entry) => entry.name);
    expect(names).toEqual(["Second find", "First find", "East of Eden"]);
  });

  // A delete that cannot be sent has not happened. Hiding the row would have
  // the collector believing they deleted something that is still there.
  it("keeps showing a row whose delete has given up, with the reason", () => {
    const blocked = { ...remove("row-1"), attempts: MAX_ATTEMPTS, lastError: "Row not found" };
    const result = applyQueueToCollection([row()], [blocked]);
    expect(result).toHaveLength(1);
    expect(result[0].pendingError).toBe("Row not found");
  });

  it("marks an item whose create has given up", () => {
    const blocked = { ...create(), attempts: MAX_ATTEMPTS, lastError: "Storage full" };
    expect(applyQueueToCollection([], [blocked])[0].pendingError).toBe("Storage full");
  });

  it("does not mark an operation that is merely waiting", () => {
    expect(applyQueueToCollection([], [create()])[0].pendingError).toBe("");
  });
});

describe("markAttempt and isBlocked", () => {
  it("counts attempts and keeps the reason", () => {
    const once = markAttempt(create(), "Failed to fetch");
    expect(once.attempts).toBe(1);
    expect(once.lastError).toBe("Failed to fetch");
    expect(isBlocked(once)).toBe(false);
  });

  it("stops retrying after the third failure", () => {
    let op = create();
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) op = markAttempt(op, "nope");
    expect(isBlocked(op)).toBe(true);
  });

  it("never grows without bound on a huge error", () => {
    expect(markAttempt(create(), "x".repeat(5000)).lastError).toHaveLength(300);
  });
});

describe("summarizeQueue and queueLabel", () => {
  const blocked = { ...update("row-9", { notes: "x" }, "op-x"), attempts: MAX_ATTEMPTS };

  it("counts what is waiting and what has given up", () => {
    const summary = summarizeQueue([create(), update("row-1", { condition: "Fair" }), blocked]);
    expect(summary).toEqual({ total: 3, waiting: 2, blocked: 1, creates: 1, updates: 2, deletes: 0 });
  });

  it("says nothing at all about an empty queue", () => {
    expect(queueLabel(summarizeQueue([]))).toBe("");
    expect(queueLabel(null)).toBe("");
  });

  it("counts in the singular when there is one of something", () => {
    expect(queueLabel(summarizeQueue([create()]))).toBe("1 change waiting to sync");
    expect(queueLabel(summarizeQueue([blocked]))).toBe("1 change needs your attention");
  });

  it("names both halves when some are waiting and some have given up", () => {
    expect(queueLabel(summarizeQueue([create(), blocked]))).toBe("1 change waiting to sync, 1 needing your attention");
  });
});

describe("describeOperation", () => {
  it("names the item a pending change is about", () => {
    expect(describeOperation(create())).toBe('Add "Dune"');
    expect(describeOperation(remove("row-1"))).toBe('Delete "Dune"');
  });

  // An edit carries only the changed fields, so the name usually has to come
  // from the collection it is an edit of.
  it("looks up the name of an edited row", () => {
    expect(describeOperation(update("row-1", { condition: "Fair" }), [row()])).toBe('Edit "East of Eden"');
  });

  it("still says something when the name is nowhere to be found", () => {
    expect(describeOperation(update("row-404", { condition: "Fair" }), [])).toBe('Edit "an item"');
  });
});
