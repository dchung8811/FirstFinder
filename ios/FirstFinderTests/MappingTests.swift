import XCTest
@testable import FirstFinder

// Ported from src/utils/mapping.test.js. csvUpdateRow's tests come over with
// the CSV import, where it's used.
final class MappingTests: XCTestCase {
    private let user = "11111111-1111-1111-1111-111111111111"

    // MARK: toDbItem

    func testToDbItemFillsDefaultsForABareItem() {
        var bare = Item(id: "")
        bare.category = ""
        bare.status = ""
        let row = Mapping.toDbItem(bare, userId: user)
        XCTAssertEqual(row.userId, user)
        XCTAssertEqual(row.category, "Other")
        XCTAssertEqual(row.status, "Owned")
        XCTAssertEqual(row.name, "")
    }

    func testKeepsTheAuthorAndTheMakerAsSeparateColumns() {
        let row = Mapping.toDbItem(Item(id: "", author: "Stephen King", maker: "Doubleday"), userId: user)
        XCTAssertEqual(row.author, "Stephen King")
        XCTAssertEqual(row.maker, "Doubleday")
    }

    // Null means "no estimate yet" and 0 means "estimated at nothing".
    func testStoresAMissingEstimateAsNilNotZero() {
        XCTAssertNil(Mapping.toDbItem(Item(id: "", estimatedValue: nil), userId: user).estimatedValue)
    }

    func testStoresAnEnteredZeroAsZero() {
        XCTAssertEqual(Mapping.toDbItem(Item(id: "", estimatedValue: 0), userId: user).estimatedValue, 0)
    }

    func testTreatsAMissingPurchasePriceAsZeroPaid() {
        XCTAssertEqual(Mapping.toDbItem(Item(id: "", purchasePrice: nil), userId: user).purchasePrice, 0)
    }

    func testCapturesSaleFieldsOnAnItemCreatedAsSold() {
        let row = Mapping.toDbItem(Item(id: "", status: "Sold", soldPrice: 120, soldDate: "2026-03-01"), userId: user)
        XCTAssertEqual(row.previousStatus, "Owned")
        XCTAssertEqual(row.soldPrice, 120)
        XCTAssertEqual(row.soldDate, "2026-03-01")
    }

    func testLeavesSaleFieldsEmptyForAnItemStillHeld() {
        let row = Mapping.toDbItem(Item(id: "", status: "Owned", soldPrice: 120, soldDate: "2026-03-01"), userId: user)
        XCTAssertNil(row.previousStatus)
        XCTAssertNil(row.soldPrice)
        XCTAssertNil(row.soldDate)
    }

    // Issue #169.
    func testStoresABlankFreeTextEditionForABook() {
        XCTAssertEqual(Mapping.toDbItem(Item(id: "", category: "Book", edition: "Book Club Edition"), userId: user).edition, "")
    }

    func testKeepsTheFreeTextEditionForEverythingElse() {
        XCTAssertEqual(Mapping.toDbItem(Item(id: "", category: "Comic", edition: "Newsstand variant"), userId: user).edition, "Newsstand variant")
    }

    func testRecordsThePhotoCountsItWasHanded() {
        let row = Mapping.toDbItem(Item(id: ""), userId: user, itemPhotoCount: 3, receiptPhotoCount: 1)
        XCTAssertEqual(row.itemPhotoCount, 3)
        XCTAssertEqual(row.receiptPhotoCount, 1)
    }

    // MARK: fromDbItem

    private func row(_ change: (inout InventoryRow) -> Void = { _ in }) -> InventoryRow {
        var row = InventoryRow(
            id: "abc", userId: user, referenceNumber: 7, name: "Dune", category: "Book",
            purchasePrice: 40, estimatedValue: 500, createdAt: "2026-01-01T00:00:00.000Z"
        )
        change(&row)
        return row
    }

    func testMapsSnakeCaseColumnsOntoCamelCaseFields() {
        let item = Mapping.fromDbItem(row { $0.bookEdition = "First"; $0.bookPrinting = "First" })
        XCTAssertEqual(item.bookEdition, "First")
        XCTAssertEqual(item.bookPrinting, "First")
        XCTAssertEqual(item.referenceNumber, 7)
    }

    func testReadsARowThatPredatesTheAuthorColumn() {
        let item = Mapping.fromDbItem(row { $0.author = nil; $0.maker = "Frank Herbert" })
        XCTAssertEqual(item.author, "")
        XCTAssertEqual(item.maker, "Frank Herbert")
    }

    func testBringsANullEstimateBackAsNilNotZero() {
        XCTAssertNil(Mapping.fromDbItem(row { $0.estimatedValue = nil }).estimatedValue)
    }

    func testBringsAZeroEstimateBackAsZero() {
        XCTAssertEqual(Mapping.fromDbItem(row { $0.estimatedValue = 0 }).estimatedValue, 0)
    }

    func testSurvivesARoundTripWithoutLosingTheNil() {
        let original = Item(id: "", name: "Dune", purchasePrice: 40, estimatedValue: nil)
        let write = Mapping.toDbItem(original, userId: user)
        let back = Mapping.fromDbItem(Mapping.row(from: write, id: "abc", itemPhotos: [], receiptPhotos: [], hiddenFromShare: false, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z"))
        XCTAssertNil(back.estimatedValue)
        XCTAssertEqual(back.purchasePrice, 40)
    }

    func testPrefersTheRealPhotoRecordsOverAStaleCount() {
        let item = Mapping.fromDbItem(row {
            $0.itemPhotos = PhotoColumn(records: [.init(path: "a/b/c.jpg", name: "cover.jpg")])
            $0.itemPhotoCount = 9
        })
        XCTAssertEqual(item.itemPhotoCount, 1)
        XCTAssertEqual(item.itemPhotos.first?.path, "a/b/c.jpg")
    }

    func testFallsBackToTheCountWhenThereAreNoRecords() {
        XCTAssertEqual(Mapping.fromDbItem(row { $0.itemPhotoCount = 2 }).itemPhotoCount, 2)
    }

    // MARK: fromDbPhotoList

    func testDropsPhotoRecordsWithNoStoragePath() throws {
        let json = #"[{"path":"a.jpg"},{"name":"orphan"},null,{"path":""}]"#
        let column = try JSONDecoder().decode(PhotoColumn.self, from: Data(json.utf8))
        XCTAssertEqual(Mapping.fromDbPhotoList(column).count, 1)
    }

    func testToleratesANonArrayPhotoColumn() throws {
        for json in ["null", #""nonsense""#, "{}"] {
            let column = try JSONDecoder().decode(PhotoColumn.self, from: Data(json.utf8))
            XCTAssertEqual(Mapping.fromDbPhotoList(column), [])
        }
    }

    // MARK: Decoding a real-shaped row

    // PostgREST returns numeric columns as JSON numbers and nulls as null.
    // The null estimate has to arrive as nil, and the row as a whole has to
    // survive a malformed photo column.
    func testDecodesAPostgrestRow() throws {
        let json = #"""
        {"id":"abc","user_id":"u","reference_number":3,"name":"Dune","category":"Book","author":"","maker":"Chilton",
         "edition":"","book_genre":"","book_edition":"First","book_printing":"First","status":"Sold","condition":"",
         "purchase_date":"2026-01-02","source":"","purchase_price":40,"estimated_value":null,"previous_status":"For sale",
         "sold_price":125.5,"sold_date":"2026-03-04","notes":"","hidden_from_share":false,"item_photos":"broken",
         "receipt_photos":[],"item_photo_count":0,"receipt_photo_count":0,"created_at":"2026-01-02T00:00:00+00:00",
         "updated_at":"2026-01-02T00:00:00+00:00"}
        """#
        let decoded = try JSONDecoder().decode(InventoryRow.self, from: Data(json.utf8))
        let item = Mapping.fromDbItem(decoded)
        XCTAssertNil(item.estimatedValue)
        XCTAssertEqual(item.soldPrice, Decimal(string: "125.5"))
        XCTAssertEqual(item.previousStatus, "For sale")
        XCTAssertEqual(item.itemPhotos, [])
    }

    // MARK: Share settings and wants

    func testNeverStoresShowOnExploreForAnUnlistedPage() {
        var settings = ShareSettings()
        settings.visibility = "unlisted"
        settings.showOnExplore = true
        XCTAssertFalse(Mapping.toDbShareRow(settings, userId: user, slug: "s").showOnExplore)
        settings.visibility = "listed"
        XCTAssertTrue(Mapping.toDbShareRow(settings, userId: user, slug: "s").showOnExplore)
    }

    func testNormalizesExplorePicks() {
        let ids = ["a", "b", "a", "", "c", "d", "e", "f", "g", "h", "i"]
        XCTAssertEqual(Mapping.normalizeExplorePicks(ids), ["a", "b", "c", "d", "e", "f", "g", "h"])
        XCTAssertEqual(Mapping.normalizeExplorePicks(nil), [])
    }

    func testAWantWithNoCeilingKeepsNil() {
        let row = WishlistRow(id: "w", userId: user, maxPrice: nil)
        XCTAssertNil(Mapping.fromDbWant(row).maxPrice)
        XCTAssertNil(Mapping.toDbWant(Mapping.fromDbWant(row), userId: user).maxPrice)
    }

    func testABlankUpgradeTargetBecomesNil() {
        XCTAssertNil(Mapping.toDbWant(Want(id: "w", upgradeForItemId: ""), userId: user).upgradeForItemId)
    }

    // MARK: Site banner (ported from siteBanner.test.js)

    func testBannerShowsOnlyWhenOnAndWorded() {
        XCTAssertFalse(Mapping.shouldShowBanner(SiteBanner(enabled: false, message: "Hi"), dismissedId: nil))
        XCTAssertFalse(Mapping.shouldShowBanner(SiteBanner(enabled: true, message: ""), dismissedId: nil))
        XCTAssertTrue(Mapping.shouldShowBanner(SiteBanner(enabled: true, message: "Hi"), dismissedId: nil))
    }

    func testDismissingABannerHidesThatVersionOnly() {
        let banner = SiteBanner(enabled: true, message: "Hi", updatedAt: "2026-07-01T00:00:00Z")
        XCTAssertFalse(Mapping.shouldShowBanner(banner, dismissedId: "2026-07-01T00:00:00Z"))
        XCTAssertTrue(Mapping.shouldShowBanner(banner, dismissedId: "2026-06-01T00:00:00Z"))
    }
}
