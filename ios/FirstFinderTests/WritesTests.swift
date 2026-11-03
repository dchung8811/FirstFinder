import Foundation
import XCTest
@testable import FirstFinder

// The bodies of the app's writes, held to what app/InventoryApp.jsx sends.
final class WritesTests: XCTestCase {
    private let now = Date(timeIntervalSince1970: 1_793_000_000)

    private func json(_ payload: RowPayload) throws -> [String: Any] {
        try XCTUnwrap(JSONSerialization.jsonObject(with: JSONEncoder().encode(payload)) as? [String: Any])
    }

    // MARK: Nulls

    // The whole reason for RowPayload: a nil is sent as null, never dropped.
    func testANilIsSentAsAnExplicitNull() throws {
        let object = try json(["estimated_value": .amount(nil), "sold_date": .text(nil)])
        XCTAssertTrue(object["estimated_value"] is NSNull)
        XCTAssertTrue(object["sold_date"] is NSNull)
    }

    // MARK: Items

    // toDbItem's exact columns: no id, no photo arrays, no hidden_from_share.
    func testTheInsertHasTheWebsColumns() throws {
        let write = Mapping.toDbItem(Item(id: "", name: "Dune", category: "Book"), userId: "u")
        XCTAssertEqual(Set(try json(Writes.itemInsert(write)).keys), [
            "user_id", "reference_number", "name", "category", "author", "maker", "edition", "book_genre",
            "book_edition", "book_printing", "status", "condition", "previous_status", "sold_price", "sold_date",
            "purchase_date", "source", "purchase_price", "estimated_value", "notes", "item_photo_count", "receipt_photo_count",
        ])
    }

    func testAnUnestimatedItemIsInsertedWithANullEstimateAndZeroPaid() throws {
        let object = try json(Writes.itemInsert(Mapping.toDbItem(Item(id: "", name: "Dune"), userId: "u")))
        XCTAssertTrue(object["estimated_value"] is NSNull, "no estimate is null, not 0")
        XCTAssertEqual(object["purchase_price"] as? Int, 0, "a blank price paid is stored as 0, as the web does")
        XCTAssertTrue(object["previous_status"] is NSNull)
    }

    func testMarkingSoldRemembersTheStatusBeforeTheSale() throws {
        let item = Item(id: "1", status: "For sale", condition: "Fine")
        let object = try json(Writes.markSold(current: item, soldPrice: "120", soldDate: "2026-10-01", condition: "", now: now))
        XCTAssertEqual(object["status"] as? String, "Sold")
        XCTAssertEqual(object["previous_status"] as? String, "For sale")
        XCTAssertEqual(object["sold_price"] as? Int, 120)
        XCTAssertEqual(object["condition"] as? String, "Fine", "a blank condition keeps the item's own")
    }

    func testMarkingAnAlreadySoldItemDoesntRememberSold() throws {
        let item = Item(id: "1", status: "Sold", previousStatus: "Owned")
        let object = try json(Writes.markSold(current: item, soldPrice: "", soldDate: "", condition: "", now: now))
        XCTAssertEqual(object["previous_status"] as? String, "Owned")
        XCTAssertTrue(object["sold_price"] is NSNull)
        XCTAssertTrue(object["sold_date"] is NSNull)
    }

    func testRestoringClearsTheSaleAndReturnsToThePreviousStatus() throws {
        let (payload, status) = Writes.restore(current: Item(id: "1", status: "Sold", previousStatus: "For sale"), now: now)
        XCTAssertEqual(status, "For sale")
        let object = try json(payload)
        XCTAssertEqual(object["status"] as? String, "For sale")
        for column in ["previous_status", "sold_price", "sold_date"] {
            XCTAssertTrue(object[column] is NSNull, "\(column) should be null")
        }
    }

    func testRestoringWithNoPreviousStatusFallsBackToOwned() {
        XCTAssertEqual(Writes.restore(current: Item(id: "1", status: "Sold"), now: now).status, "Owned")
    }

    func testAnEditMovingOutOfSoldClearsTheSaleFields() throws {
        let current = Item(id: "1", status: "Sold", previousStatus: "Owned", soldPrice: 50, soldDate: "2026-01-01")
        var draft = current
        draft.status = "Owned"
        let object = try json(Writes.itemUpdate(draft: draft, current: current, itemPhotos: [], receiptPhotos: [], now: now))
        XCTAssertTrue(object["previous_status"] is NSNull)
        XCTAssertTrue(object["sold_price"] is NSNull)
        XCTAssertTrue(object["sold_date"] is NSNull)
    }

    func testAnEditMovingIntoSoldRemembersTheOldStatus() throws {
        let current = Item(id: "1", status: "Owned")
        var draft = current
        draft.status = "Sold"
        draft.soldPrice = 80
        let object = try json(Writes.itemUpdate(draft: draft, current: current, itemPhotos: [], receiptPhotos: [], now: now))
        XCTAssertEqual(object["previous_status"] as? String, "Owned")
        XCTAssertEqual(object["sold_price"] as? Int, 80)
    }

    func testAnEditCarriesThePhotoListsAndCounts() throws {
        let photos = [Photo(path: "u/1/item-1-a-a.jpg", name: "a.jpg"), Photo(path: "u/1/item-2-b-b.jpg", name: "b.jpg")]
        let object = try json(Writes.itemUpdate(draft: Item(id: "1"), current: Item(id: "1"), itemPhotos: photos, receiptPhotos: [], now: now))
        XCTAssertEqual((object["item_photos"] as? [[String: String]])?.map { $0["path"] }, photos.map(\.path))
        XCTAssertEqual(object["item_photo_count"] as? Int, 2)
        XCTAssertEqual(object["receipt_photo_count"] as? Int, 0)
    }

    // csvUpdateRow: only what changed, so an inline edit can't overwrite a
    // field changed on another device.
    func testAnInlineEditWritesOnlyTheNamedColumns() throws {
        let object = try json(Writes.fieldUpdate(current: Item(id: "1", name: "Old"), fields: ["name": "New"], now: now))
        XCTAssertEqual(Set(object.keys), ["name", "updated_at"])
        XCTAssertEqual(object["name"] as? String, "New")
    }

    func testAnInlineMoveToSoldSetsTheSaleColumns() throws {
        let object = try json(Writes.fieldUpdate(current: Item(id: "1", status: "For sale"), fields: ["status": "Sold", "soldDate": "2026-10-02"], now: now))
        XCTAssertEqual(object["previous_status"] as? String, "For sale")
        XCTAssertEqual(object["sold_date"] as? String, "2026-10-02")
        XCTAssertTrue(object["sold_price"] is NSNull)
    }

    func testABlankInlineEstimateIsNull() throws {
        let object = try json(Writes.fieldUpdate(current: Item(id: "1", estimatedValue: 40), fields: ["estimatedValue": ""], now: now))
        XCTAssertTrue(object["estimated_value"] is NSNull)
    }

    // MARK: Wishlist

    func testABlankUpgradeTargetIsNullNotEmpty() throws {
        let object = try json(Writes.want(Mapping.toDbWant(Want(id: "", name: "Dune"), userId: "u"), now: now))
        XCTAssertTrue(object["upgrade_for_item_id"] is NSNull, "the column is a uuid; \"\" is not one")
        XCTAssertTrue(object["max_price"] is NSNull)
    }

    // MARK: Photos

    func testAPhotoPathIsOwnerItemKindTimeRandomName() {
        let path = Writes.photoPath(userId: "u1", itemId: "i1", kind: "receipt", name: "my receipt (1).jpg", now: now, random: "abc123")
        XCTAssertEqual(path, "u1/i1/receipt-1793000000000-abc123-my_receipt__1_.jpg")
    }

    func testAPhotoPathKeepsOnlyTheLast60CharactersOfTheName() {
        let path = Writes.photoPath(userId: "u", itemId: "i", kind: "item", name: String(repeating: "a", count: 100) + ".jpg", now: now, random: "r")
        XCTAssertEqual(path.split(separator: "-").last?.count, 60)
    }

    // MARK: Retrying and errors

    func testWhichFailuresAreWorthRetrying() {
        XCTAssertTrue(WriteRetry.isRetryable(code: nil), "no code: a gateway timeout or dropped connection")
        XCTAssertTrue(WriteRetry.isRetryable(code: "08006"))
        XCTAssertTrue(WriteRetry.isRetryable(code: "57014"))
        XCTAssertFalse(WriteRetry.isRetryable(code: "23505"), "a constraint will refuse it again")
        XCTAssertFalse(WriteRetry.isRetryable(code: "PGRST116"))
    }

    func testARetryableFailureIsRetriedUntilItLands() async throws {
        let attempts = Counter()
        let value = try await WriteRetry.run(sleep: { _ in }) {
            if await attempts.next() < 3 { throw StoreError.write("504", code: nil) }
            return "saved"
        }
        XCTAssertEqual(value, "saved")
        let count = await attempts.value
        XCTAssertEqual(count, 3)
    }

    func testARefusedWriteIsNotRetried() async {
        let attempts = Counter()
        do {
            _ = try await WriteRetry.run(sleep: { _ in }) { () async throws -> String in
                _ = await attempts.next()
                throw StoreError.write("duplicate", code: "23505")
            }
            XCTFail("should have thrown")
        } catch {}
        let count = await attempts.value
        XCTAssertEqual(count, 1)
    }

    func testRetriesStopAfterTheLastDelay() async {
        let attempts = Counter()
        do {
            _ = try await WriteRetry.run(sleep: { _ in }) { () async throws -> String in
                _ = await attempts.next()
                throw StoreError.write("504", code: nil)
            }
            XCTFail("should have thrown")
        } catch {}
        let count = await attempts.value
        XCTAssertEqual(count, WriteRetry.delays.count + 1)
    }

    // writeErrors.js: zero rows written means RLS stopped it -- a session
    // that has ended -- not PostgREST's own words.
    func testZeroRowsWrittenReadsAsSignedOut() {
        XCTAssertEqual(StoreError.write("Cannot coerce the result to a single JSON object", code: "PGRST116").localizedDescription, WriteRetry.signedOutMessage)
        XCTAssertEqual(StoreError.write("", code: "XX000").localizedDescription, "Something went wrong saving that. Please try again.")
    }
}

private actor Counter {
    private(set) var value = 0
    func next() -> Int {
        value += 1
        return value
    }
}
