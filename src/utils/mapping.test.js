import { describe, it, expect } from "vitest";
import { toDbItem, fromDbItem, fromDbPhotoList, csvUpdateRow } from "./mapping";

const USER = "11111111-1111-1111-1111-111111111111";

describe("toDbItem", () => {
  it("fills defaults for a bare item", () => {
    const row = toDbItem({}, USER);
    expect(row.user_id).toBe(USER);
    expect(row.category).toBe("Other");
    expect(row.status).toBe("Owned");
    expect(row.name).toBe("");
  });

  // Null means "no estimate yet" and 0 means "estimated at nothing". Collapsing
  // them would make a blank field read as a total loss after a reload.
  it("stores a missing estimate as null, not zero", () => {
    expect(toDbItem({ estimatedValue: "" }, USER).estimated_value).toBe(null);
  });

  it("stores an entered zero as zero", () => {
    expect(toDbItem({ estimatedValue: "0" }, USER).estimated_value).toBe(0);
  });

  it("treats a missing purchase price as zero paid", () => {
    expect(toDbItem({ purchasePrice: "" }, USER).purchase_price).toBe(0);
  });

  it("captures sale fields on an item created as sold", () => {
    const row = toDbItem({ status: "Sold", soldPrice: "120", soldDate: "2026-03-01" }, USER);
    expect(row.previous_status).toBe("Owned");
    expect(row.sold_price).toBe(120);
    expect(row.sold_date).toBe("2026-03-01");
  });

  it("leaves sale fields empty for an item still held", () => {
    const row = toDbItem({ status: "Owned", soldPrice: "120", soldDate: "2026-03-01" }, USER);
    expect(row.previous_status).toBe(null);
    expect(row.sold_price).toBe(null);
    expect(row.sold_date).toBe(null);
  });

  it("records the photo counts it was handed", () => {
    const row = toDbItem({}, USER, 3, 1);
    expect(row.item_photo_count).toBe(3);
    expect(row.receipt_photo_count).toBe(1);
  });
});

describe("fromDbItem", () => {
  const row = (over = {}) => ({
    id: "abc",
    reference_number: 7,
    name: "Dune",
    category: "Book",
    purchase_price: 40,
    estimated_value: 500,
    created_at: "2026-01-01T00:00:00.000Z",
    ...over
  });

  it("maps snake_case columns onto camelCase fields", () => {
    const item = fromDbItem(row({ book_edition: "First", book_printing: "First" }));
    expect(item.bookEdition).toBe("First");
    expect(item.bookPrinting).toBe("First");
    expect(item.referenceNumber).toBe(7);
  });

  it("brings a null estimate back as a blank field, not '0'", () => {
    expect(fromDbItem(row({ estimated_value: null })).estimatedValue).toBe("");
  });

  it("brings a zero estimate back as '0'", () => {
    expect(fromDbItem(row({ estimated_value: 0 })).estimatedValue).toBe("0");
  });

  it("survives a round trip without losing the null", () => {
    const original = { estimatedValue: "", purchasePrice: "40", name: "Dune" };
    const back = fromDbItem({ ...toDbItem(original, USER), id: "abc" });
    expect(back.estimatedValue).toBe("");
    expect(back.purchasePrice).toBe("40");
  });

  it("prefers the real photo records over a stale count", () => {
    const item = fromDbItem(row({
      item_photos: [{ path: "a/b/c.jpg", name: "cover.jpg" }],
      item_photo_count: 9
    }));
    expect(item.itemPhotoCount).toBe(1);
    expect(item.itemPhotos[0].path).toBe("a/b/c.jpg");
  });
});

describe("fromDbPhotoList", () => {
  it("drops records with no storage path", () => {
    expect(fromDbPhotoList([{ path: "a.jpg" }, { name: "orphan" }, null])).toHaveLength(1);
  });

  it("tolerates a non-array column", () => {
    expect(fromDbPhotoList(null)).toEqual([]);
    expect(fromDbPhotoList("nonsense")).toEqual([]);
  });
});

describe("csvUpdateRow", () => {
  const existing = { id: "abc", status: "Owned", previousStatus: "", soldPrice: "", soldDate: "" };

  // A bulk edit must never be able to wipe uploaded images, so the photo
  // columns are simply never written by this path.
  it("never writes the photo columns", () => {
    const row = csvUpdateRow(existing, { name: "Dune" }, USER);
    expect(row).not.toHaveProperty("item_photos");
    expect(row).not.toHaveProperty("receipt_photos");
    expect(row).not.toHaveProperty("item_photo_count");
  });

  // If someone exports, deletes a column in their spreadsheet, and re-uploads,
  // the absent column must be left alone rather than blanked on every item.
  it("only touches columns the file actually carried", () => {
    const row = csvUpdateRow(existing, { name: "Dune" }, USER);
    expect(row.name).toBe("Dune");
    expect(row).not.toHaveProperty("status");
    expect(row).not.toHaveProperty("purchase_date");
    expect(row).not.toHaveProperty("estimated_value");
  });

  it("keeps identity columns on every update", () => {
    const row = csvUpdateRow(existing, { name: "Dune" }, USER);
    expect(row.id).toBe("abc");
    expect(row.user_id).toBe(USER);
    expect(row.updated_at).toBeTruthy();
  });

  it("stores a blanked estimate as null", () => {
    expect(csvUpdateRow(existing, { estimatedValue: "" }, USER).estimated_value).toBe(null);
  });

  it("records where an item came from when a CSV marks it sold", () => {
    const row = csvUpdateRow(existing, { status: "Sold", soldPrice: "120", soldDate: "2026-03-01" }, USER);
    expect(row.previous_status).toBe("Owned");
    expect(row.sold_price).toBe(120);
    expect(row.sold_date).toBe("2026-03-01");
  });

  it("clears the sale when a CSV moves an item back out of sold", () => {
    const sold = { id: "abc", status: "Sold", previousStatus: "Owned", soldPrice: "120", soldDate: "2026-03-01" };
    const row = csvUpdateRow(sold, { status: "Owned" }, USER);
    expect(row.previous_status).toBe(null);
    expect(row.sold_price).toBe(null);
    expect(row.sold_date).toBe(null);
  });
});
