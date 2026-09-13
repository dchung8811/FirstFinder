import { describe, it, expect } from "vitest";
import { photoKindFromPath, originalNameFromPath, reconcilePhotoLists } from "./photoReconcile";

const OWNER = "user-1";
const ITEM = "item-abc";
const p = (file) => `${OWNER}/${ITEM}/${file}`;

const ITEM_FILE = "item-1789269305347-4jwznz-image.jpg";
const RECEIPT_FILE = "receipt-1789268438771-493rxp-image.jpg";

describe("photoKindFromPath", () => {
  it("reads the kind the uploader wrote into the name", () => {
    expect(photoKindFromPath(p(ITEM_FILE))).toBe("item");
    expect(photoKindFromPath(p(RECEIPT_FILE))).toBe("receipt");
  });

  // Guessing would put receipts in among the item photos.
  it("refuses to guess for anything it did not write", () => {
    expect(photoKindFromPath(p("IMG_8771.HEIC"))).toBeNull();
    expect(photoKindFromPath(p("scan-123-abc-x.jpg"))).toBeNull();
    expect(photoKindFromPath("")).toBeNull();
    expect(photoKindFromPath(null)).toBeNull();
  });
});

describe("originalNameFromPath", () => {
  it("strips the kind, timestamp and random suffix", () => {
    expect(originalNameFromPath(p(ITEM_FILE))).toBe("image.jpg");
  });

  // safeName keeps dashes, so it cannot be taken as one segment.
  it("keeps dashes that belong to the name", () => {
    expect(originalNameFromPath(p("item-1789-abcdef-my-first-edition.jpg"))).toBe("my-first-edition.jpg");
  });

  it("falls back to the filename when the shape is unfamiliar", () => {
    expect(originalNameFromPath(p("odd.jpg"))).toBe("odd.jpg");
  });
});

describe("reconcilePhotoLists", () => {
  const linked = [{ path: p("item-1-aaaaaa-a.jpg"), name: "a.jpg" }];

  it("adopts nothing when the row already knows everything", () => {
    const result = reconcilePhotoLists([p("item-1-aaaaaa-a.jpg")], linked, []);
    expect(result.adopted).toBe(0);
    expect(result.itemPhotos).toBe(linked);
  });

  // The incident: four files uploaded, the linking write timed out, the row
  // ended up pointing at a later batch and these were stranded.
  it("adopts files the row has no record of", () => {
    const orphan = p(ITEM_FILE);
    const result = reconcilePhotoLists([p("item-1-aaaaaa-a.jpg"), orphan], linked, []);

    expect(result.adopted).toBe(1);
    expect(result.itemPhotos).toHaveLength(2);
    expect(result.itemPhotos[1]).toEqual({ path: orphan, name: "image.jpg" });
  });

  it("puts receipts on the receipt list", () => {
    const result = reconcilePhotoLists([p(RECEIPT_FILE)], [], []);
    expect(result.receiptPhotos).toHaveLength(1);
    expect(result.itemPhotos).toHaveLength(0);
    expect(result.adopted).toBe(1);
  });

  it("sorts a mixed batch onto the right lists", () => {
    const result = reconcilePhotoLists([p(ITEM_FILE), p(RECEIPT_FILE)], [], []);
    expect(result.itemPhotos).toHaveLength(1);
    expect(result.receiptPhotos).toHaveLength(1);
    expect(result.adopted).toBe(2);
  });

  // A reconstructed name is strictly worse than the one the reader's file
  // actually had, so existing entries are never rewritten.
  it("leaves existing entries and their order untouched", () => {
    const existing = [
      { path: p("item-1-aaaaaa-first.jpg"), name: "Dust jacket, front" },
      { path: p("item-2-bbbbbb-second.jpg"), name: "Copyright page" }
    ];
    const result = reconcilePhotoLists(
      [p("item-2-bbbbbb-second.jpg"), p("item-1-aaaaaa-first.jpg"), p(ITEM_FILE)],
      existing,
      []
    );
    expect(result.itemPhotos.slice(0, 2)).toEqual(existing);
    expect(result.itemPhotos[2].path).toBe(p(ITEM_FILE));
  });

  it("ignores files it cannot classify rather than filing them wrongly", () => {
    const result = reconcilePhotoLists([p("IMG_8771.HEIC")], [], []);
    expect(result.adopted).toBe(0);
  });

  it("does not adopt the same path twice from a repeated listing", () => {
    const orphan = p(ITEM_FILE);
    const result = reconcilePhotoLists([orphan, orphan], [], []);
    expect(result.adopted).toBe(1);
  });

  it("does not re-adopt a file already on the other list", () => {
    // A receipt-prefixed file that someone previously filed under item photos
    // is still accounted for, and must not be added a second time.
    const path = p(RECEIPT_FILE);
    const result = reconcilePhotoLists([path], [{ path, name: "r.jpg" }], []);
    expect(result.adopted).toBe(0);
  });

  it("survives empty and missing input", () => {
    expect(reconcilePhotoLists([], null, undefined).adopted).toBe(0);
    expect(reconcilePhotoLists(null, [], []).adopted).toBe(0);
  });
});
