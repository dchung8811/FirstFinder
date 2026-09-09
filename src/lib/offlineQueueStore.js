// Where offline writes wait, and the only place that touches IndexedDB.
//
// IndexedDB rather than the localStorage the snapshot uses, for one reason:
// photos. A queued find carries the pictures that make it worth keeping, a
// photo is megabytes, and localStorage holds a few and stores strings. IndexedDB
// stores Blobs as Blobs.
//
// The contract every function here keeps: it either does what it says or
// reports that it could not, and it never throws into the app. The caller has
// to be able to tell the difference, because "the save is queued" and "the
// save is gone" must never look the same to a collector standing in a shop --
// see requireOnline in the app, which refuses a write outright when this store
// is unavailable rather than accepting one it cannot keep.

const DB_NAME = "firstfinder-offline";
const DB_VERSION = 1;
const OPERATION_STORE = "operations";
const PHOTO_STORE = "photos";

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(OPERATION_STORE)) {
        const store = db.createObjectStore(OPERATION_STORE, { keyPath: "id" });
        store.createIndex("userId", "userId", { unique: false });
      }
      // Keyed by the operation's id, so photos and the operation they belong
      // to are written and deleted together.
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        db.createObjectStore(PHOTO_STORE, { keyPath: "operationId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open the offline database."));
    // Private windows in some browsers hang the open rather than failing it.
    request.onblocked = () => reject(new Error("The offline database is blocked."));
  });
}

function runTransaction(db, storeNames, mode, work) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeNames, mode);
    let result;

    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error || new Error("The offline database rejected the write."));
    transaction.onabort = () => reject(transaction.error || new Error("The offline write was aborted."));

    // The work runs inside the transaction and hands back whatever the caller
    // wants, but resolution waits for oncomplete -- a write that has not
    // committed is not a write.
    result = work(...storeNames.map((name) => transaction.objectStore(name)));
    if (result && typeof result.then === "function") {
      reject(new Error("Transaction work must be synchronous."));
      transaction.abort();
    }
  });
}

function requestValue(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// True when this browser can actually hold a queue. Checked before a write is
// accepted offline, so the app never promises to keep something it cannot.
export async function isQueueAvailable() {
  try {
    const db = await openDatabase();
    db.close();
    return true;
  } catch {
    return false;
  }
}

export async function loadQueue(userId) {
  if (!userId) return [];

  try {
    const db = await openDatabase();
    const transaction = db.transaction([OPERATION_STORE], "readonly");
    const all = await requestValue(transaction.objectStore(OPERATION_STORE).index("userId").getAll(userId));
    db.close();
    // Replay order is the order the collector worked in. Anything else would
    // apply an edit before the create it belongs to.
    return (all || []).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  } catch (error) {
    console.error("Offline queue read error:", error.message);
    return [];
  }
}

// Writes one operation, and the photo blobs that belong to it when there are
// any. Returns false if it could not be stored -- the caller must not tell the
// collector their find is safe when it is not.
export async function saveOperation(operation, photos) {
  try {
    const db = await openDatabase();
    const stores = photos ? [OPERATION_STORE, PHOTO_STORE] : [OPERATION_STORE];

    await runTransaction(db, stores, "readwrite", (operationStore, photoStore) => {
      operationStore.put(operation);
      if (photoStore) {
        photoStore.put({
          operationId: operation.id,
          itemPhotos: photos.itemPhotos || [],
          receiptPhotos: photos.receiptPhotos || []
        });
      }
    });

    db.close();
    return true;
  } catch (error) {
    console.error("Offline queue write error:", error.message);
    return false;
  }
}

export async function loadOperationPhotos(operationId) {
  try {
    const db = await openDatabase();
    const transaction = db.transaction([PHOTO_STORE], "readonly");
    const record = await requestValue(transaction.objectStore(PHOTO_STORE).get(operationId));
    db.close();
    return { itemPhotos: record?.itemPhotos || [], receiptPhotos: record?.receiptPhotos || [] };
  } catch (error) {
    console.error("Offline photo read error:", error.message);
    return { itemPhotos: [], receiptPhotos: [] };
  }
}

// Removes operations and their photos together. Called when the server has
// accepted a write, and when the collector discards one.
export async function removeOperations(ids) {
  const list = (ids || []).filter(Boolean);
  if (list.length === 0) return true;

  try {
    const db = await openDatabase();
    await runTransaction(db, [OPERATION_STORE, PHOTO_STORE], "readwrite", (operationStore, photoStore) => {
      list.forEach((id) => {
        operationStore.delete(id);
        photoStore.delete(id);
      });
    });
    db.close();
    return true;
  } catch (error) {
    console.error("Offline queue delete error:", error.message);
    return false;
  }
}

// Everything this user has waiting. Used on sign-out and account deletion --
// the same shared-laptop reasoning as the snapshot, with more at stake, since
// a queued find includes photographs.
export async function clearQueue(userId) {
  const operations = await loadQueue(userId);
  return removeOperations(operations.map((operation) => operation.id));
}
