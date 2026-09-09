// Changes made with no signal, waiting for one.
//
// Issue #147, the write half of #60. The read half (offlineCollection.js) put
// the collection in the collector's pocket; this is what lets them add the
// book they are holding, in the basement where they found it.
//
// Everything here is pure. That is not a style preference: this module decides
// what happens to records that exist nowhere else yet -- a photographed find
// that has never reached Postgres lives only in this queue -- so the rules
// have to be testable exhaustively, without a network to mock or a database to
// reset. The IndexedDB half lives in src/lib/offlineQueueStore.js, and the
// replay lives in the app.
//
// Three rules run through the whole file:
//
//   Never lose an intention. An operation leaves the queue when the server has
//   accepted it, or when the collector discards it themselves. Never because
//   it was inconvenient.
//
//   Collapse before sending, not after. Ten edits to the same book in a shop
//   are one row's worth of changes; replaying all ten would be ten chances to
//   half-fail.
//
//   Only overwrite what was actually typed. An update carries the fields the
//   collector changed, never a whole row, so a queued edit landing on a row
//   that changed on another device overwrites the edited fields and leaves the
//   rest alone.

// Bumped when the operation shape changes. Unlike the snapshot, a queue from
// an older version cannot simply be dropped -- it holds writes that exist
// nowhere else -- so the store keeps it and the app reports it rather than
// replaying something it does not understand.
export const QUEUE_VERSION = 1;

// After this many failed replays an operation stops being retried on its own
// and waits for the collector. Something that has failed three times is not
// going to succeed on the fourth; it needs a person to look at the error.
export const MAX_ATTEMPTS = 3;

// Rows that exist only in the queue carry an id of this shape. It is checked
// before every write to Postgres: a "pending-..." id is not a uuid, and the
// point of the prefix is that a mistake fails loudly here rather than quietly
// there.
export const PENDING_ID_PREFIX = "pending-";

export function isPendingId(id) {
  return String(id || "").startsWith(PENDING_ID_PREFIX);
}

export function newPendingId(suffix) {
  return `${PENDING_ID_PREFIX}${suffix}`;
}

function baseOperation({ userId, at, id }) {
  return {
    id,
    userId: userId || "",
    createdAt: at || new Date().toISOString(),
    attempts: 0,
    lastError: ""
  };
}

// A whole item that has never been saved. `fields` is the item as the form had
// it; the photos travel beside it as blobs, held by the store.
export function createOperation({ userId, item, itemPhotoCount = 0, receiptPhotoCount = 0, at, id }) {
  return {
    ...baseOperation({ userId, at, id }),
    kind: "create",
    itemId: item.id,
    fields: { ...item },
    itemPhotoCount,
    receiptPhotoCount
  };
}

// Only the fields the collector changed. See the third rule at the top: this
// is the difference between "my edit won" and "my edit reverted a change I
// made on my phone".
export function updateOperation({ userId, itemId, fields, at, id }) {
  return { ...baseOperation({ userId, at, id }), kind: "update", itemId, fields: { ...fields } };
}

export function deleteOperation({ userId, itemId, name, at, id }) {
  return { ...baseOperation({ userId, at, id }), kind: "delete", itemId, name: name || "" };
}

// Adds an operation to the queue, collapsing it against what is already
// waiting. Returns the new queue and what became of the incoming operation, so
// the caller knows whether it has blobs to store or an entry to remove.
//
//   create then update  -> one create, with the edit folded in. The row does
//     not exist server-side yet, so an update against its id could not be sent
//     at all.
//   create then delete  -> nothing. A find added and then abandoned in the
//     same aisle never needs to reach the server.
//   update then update  -> one update, later field wins. Ten edits, one write.
//   update then delete  -> just the delete. Editing a row and then deleting it
//     makes the edit moot, and sending it first is a write that can fail on
//     its own.
export function enqueue(operations, incoming) {
  const queue = [...(operations || [])];
  const forItem = (op) => op.itemId === incoming.itemId;

  if (incoming.kind === "update") {
    const createIndex = queue.findIndex((op) => op.kind === "create" && forItem(op));
    if (createIndex !== -1) {
      const create = queue[createIndex];
      const merged = { ...create, fields: { ...create.fields, ...incoming.fields } };
      queue[createIndex] = merged;
      return { queue, stored: merged, removedIds: [] };
    }

    const updateIndex = queue.findIndex((op) => op.kind === "update" && forItem(op));
    if (updateIndex !== -1) {
      const existing = queue[updateIndex];
      // The merged operation keeps the earlier entry's place in the queue and
      // its failure history: it is the same pending change to the same row,
      // now saying a bit more.
      const merged = { ...existing, fields: { ...existing.fields, ...incoming.fields }, lastError: "" };
      queue[updateIndex] = merged;
      return { queue, stored: merged, removedIds: [] };
    }

    return { queue: [...queue, incoming], stored: incoming, removedIds: [] };
  }

  if (incoming.kind === "delete") {
    const hasPendingCreate = queue.some((op) => op.kind === "create" && forItem(op));
    const removedIds = queue.filter(forItem).map((op) => op.id);
    const remaining = queue.filter((op) => !forItem(op));

    // A create that never left the device takes its edits and its delete with
    // it. Nothing is sent, and nothing is lost -- there was never a row.
    if (hasPendingCreate) return { queue: remaining, stored: null, removedIds };

    return { queue: [...remaining, incoming], stored: incoming, removedIds };
  }

  return { queue: [...queue, incoming], stored: incoming, removedIds: [] };
}

// The shelf as the collector should see it: what the server (or the snapshot)
// last said, with everything still waiting applied on top.
//
// This is what stops a queued find from vanishing the moment a refetch
// succeeds, and what stops a collector adding the same book twice because
// their own addition was invisible.
export function applyQueueToCollection(items, operations) {
  let result = (items || []).map((item) => ({ ...item }));

  (operations || []).forEach((op) => {
    if (op.kind === "create") {
      result = [
        {
          ...op.fields,
          id: op.itemId,
          itemPhotos: [],
          receiptPhotos: [],
          itemPhotoCount: op.itemPhotoCount || 0,
          receiptPhotoCount: op.receiptPhotoCount || 0,
          savedAt: op.createdAt,
          pendingSync: true,
          pendingError: isBlocked(op) ? op.lastError || "This could not be saved." : ""
        },
        ...result
      ];
      return;
    }

    if (op.kind === "update") {
      result = result.map((item) =>
        item.id === op.itemId
          ? {
              ...item,
              ...op.fields,
              pendingSync: true,
              pendingError: isBlocked(op) ? op.lastError || "This change could not be saved." : ""
            }
          : item
      );
      return;
    }

    if (op.kind === "delete") {
      // A blocked delete stays visible rather than disappearing from a shelf
      // it is still on: the row is still in Postgres, and pretending otherwise
      // would have the collector believing they deleted something they did not.
      if (isBlocked(op)) {
        result = result.map((item) =>
          item.id === op.itemId ? { ...item, pendingSync: true, pendingError: op.lastError || "This could not be deleted." } : item
        );
        return;
      }
      result = result.filter((item) => item.id !== op.itemId);
    }
  });

  return result;
}

export function isBlocked(operation) {
  return (operation?.attempts || 0) >= MAX_ATTEMPTS;
}

// Records a failed replay. The operation is kept -- see the first rule at the
// top -- and carries why, so the collector is told something specific rather
// than "sync failed".
export function markAttempt(operation, error) {
  return {
    ...operation,
    attempts: (operation.attempts || 0) + 1,
    lastError: String(error || "").slice(0, 300)
  };
}

export function summarizeQueue(operations) {
  const queue = operations || [];
  const blocked = queue.filter(isBlocked);

  return {
    total: queue.length,
    waiting: queue.length - blocked.length,
    blocked: blocked.length,
    creates: queue.filter((op) => op.kind === "create").length,
    updates: queue.filter((op) => op.kind === "update").length,
    deletes: queue.filter((op) => op.kind === "delete").length
  };
}

// The sentence the pending list shows for one operation. Names the item where
// it can, because "1 edit waiting" is not something a collector can check.
export function describeOperation(operation, items = []) {
  const known = items.find((item) => item.id === operation.itemId);
  const name = operation.fields?.name || known?.name || operation.name || "an item";

  if (operation.kind === "create") return `Add "${name}"`;
  if (operation.kind === "delete") return `Delete "${name}"`;
  return `Edit "${name}"`;
}

// The line the banner and the pending panel lead with.
export function queueLabel(summary) {
  if (!summary || summary.total === 0) return "";
  if (summary.blocked > 0 && summary.waiting === 0) {
    return summary.blocked === 1 ? "1 change needs your attention" : `${summary.blocked} changes need your attention`;
  }
  const waiting = summary.waiting === 1 ? "1 change waiting to sync" : `${summary.waiting} changes waiting to sync`;
  if (summary.blocked === 0) return waiting;
  return `${waiting}, ${summary.blocked} needing your attention`;
}
