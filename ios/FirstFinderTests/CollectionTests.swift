import XCTest
@testable import FirstFinder

// csvUpdateRow's tests from src/utils/mapping.test.js, applied to rows.
final class CsvUpdateTests: XCTestCase {
    private let existing = InventoryRow(id: "abc", userId: "u", name: "Old", category: "Book", status: "Owned", itemPhotos: PhotoColumn(records: [.init(path: "a.jpg", name: "a")]), itemPhotoCount: 1)

    func testNeverTouchesThePhotoColumns() {
        let row = Mapping.csvUpdatedRow(existing, fields: ["name": "Dune"])
        XCTAssertEqual(row.itemPhotos, existing.itemPhotos)
        XCTAssertEqual(row.itemPhotoCount, 1)
    }

    func testOnlyTouchesColumnsTheFileCarried() {
        let row = Mapping.csvUpdatedRow(existing, fields: ["name": "Dune"])
        XCTAssertEqual(row.name, "Dune")
        XCTAssertEqual(row.status, "Owned")
        XCTAssertNil(row.estimatedValue)
    }

    func testIgnoresAnEditionColumnOnABookRow() {
        XCTAssertEqual(Mapping.csvUpdatedRow(existing, fields: ["edition": "First edition candidate"]).edition, "")
    }

    func testClearsTheEditionWhenMovedIntoBook() {
        var comic = existing
        comic.category = "Comic"
        comic.edition = "Variant cover"
        XCTAssertEqual(Mapping.csvUpdatedRow(comic, fields: ["category": "Book"]).edition, "")
    }

    func testStoresABlankedEstimateAsNil() {
        var valued = existing
        valued.estimatedValue = 40
        XCTAssertNil(Mapping.csvUpdatedRow(valued, fields: ["estimatedValue": ""]).estimatedValue)
    }

    func testRecordsWhereAnItemCameFromWhenMarkedSold() {
        let row = Mapping.csvUpdatedRow(existing, fields: ["status": "Sold", "soldPrice": "120", "soldDate": "2026-03-01"])
        XCTAssertEqual(row.previousStatus, "Owned")
        XCTAssertEqual(row.soldPrice, 120)
        XCTAssertEqual(row.soldDate, "2026-03-01")
    }

    func testClearsTheSaleWhenMovedBackOutOfSold() {
        var sold = existing
        sold.status = "Sold"
        sold.previousStatus = "Owned"
        sold.soldPrice = 120
        sold.soldDate = "2026-03-01"
        let row = Mapping.csvUpdatedRow(sold, fields: ["status": "Owned"])
        XCTAssertNil(row.previousStatus)
        XCTAssertNil(row.soldPrice)
        XCTAssertNil(row.soldDate)
    }
}

// Ported from src/utils/publicCollection.test.js (the parts the dialog uses).
final class PublicCollectionTests: XCTestCase {
    func testDefaultsShowNothingAboutMoney() {
        let item = Item(id: "1", name: "Dune", purchasePrice: 40, estimatedValue: 500, soldPrice: 600, notes: "top shelf, study")
        let shown = PublicCollection.buildPublicItem(item, ShareSettings())
        XCTAssertNil(shown.estimatedValue)
        XCTAssertNil(shown.purchasePrice)
        XCTAssertNil(shown.notes)
    }

    func testReceiptPhotosAreNeverPublishedOnlyTheirExistence() {
        let item = Item(id: "1", receiptPhotos: [Photo(path: "r.jpg", name: "receipt")])
        let shown = PublicCollection.buildPublicItem(item, PublicCollection.applyPreset(ShareSettings(), presetId: "ledger"))
        XCTAssertTrue(shown.hasReceipt)
        XCTAssertFalse(shown.photos.contains { $0.path == "r.jpg" })
    }

    func testMembership() {
        var settings = ShareSettings()
        XCTAssertTrue(PublicCollection.isItemShared(Item(id: "1"), settings))
        XCTAssertFalse(PublicCollection.isItemShared(Item(id: "1", hiddenFromShare: true), settings))
        XCTAssertFalse(PublicCollection.isItemShared(Item(id: "1", status: "Sold"), settings))
        settings.showSold = true
        XCTAssertTrue(PublicCollection.isItemShared(Item(id: "1", status: "Sold"), settings))
    }

    func testPresetsRoundTrip() {
        for preset in PublicCollection.presets {
            XCTAssertEqual(PublicCollection.matchingPresetId(PublicCollection.applyPreset(ShareSettings(), presetId: preset.id)), preset.id)
        }
        var custom = ShareSettings()
        custom.showNotes = true
        XCTAssertNil(PublicCollection.matchingPresetId(custom))
    }

    func testSlugs() {
        let slug = PublicCollection.generateSlug()
        XCTAssertTrue(PublicCollection.isValidSlug(slug))
        XCTAssertFalse(PublicCollection.isValidSlug("short"))
        XCTAssertFalse(PublicCollection.isValidSlug(String(repeating: "0", count: 22)), "0 is left out of the alphabet")
    }

    func testSettingsChanged() {
        var draft = ShareSettings()
        XCTAssertFalse(PublicCollection.settingsChanged(saved: ShareSettings(), draft: draft))
        draft.title = "  "
        XCTAssertFalse(PublicCollection.settingsChanged(saved: ShareSettings(), draft: draft), "whitespace isn't an edit")
        draft.exploreItemIds = ["a"]
        XCTAssertTrue(PublicCollection.settingsChanged(saved: ShareSettings(), draft: draft))
    }

    func testToggleExplorePick() {
        XCTAssertEqual(PublicCollection.toggleExplorePick(["a", "b"], "a"), ["b"])
        XCTAssertEqual(PublicCollection.toggleExplorePick(["a"], "b"), ["a", "b"])
        let full = (1...8).map(String.init)
        XCTAssertEqual(PublicCollection.toggleExplorePick(full, "9"), full)
    }

    func testEditionLine() {
        XCTAssertEqual(PublicCollection.editionLine(category: "Book", edition: "x", bookEdition: "First", bookPrinting: "Second"), "First edition · Second printing")
        XCTAssertEqual(PublicCollection.editionLine(category: "Comic", edition: "Variant", bookEdition: "", bookPrinting: ""), "Variant")
    }
}

// The collection's actions, end to end through the overlay, in Sample mode.
@MainActor
final class CollectionActionTests: XCTestCase {
    private func signedInSample() async -> AppModel {
        let app = AppModel(config: .failure(.missing))
        app.sampleStore.scenario = .full
        await app.start()
        return app
    }

    func testRestoringASoldItemReturnsItToItsPreviousStatus() async {
        let app = await signedInSample()
        guard let item = app.inventory.first(where: { $0.status == "For sale" }) else { return XCTFail("no For sale sample item") }
        app.markSold(item.id, soldPrice: "75", soldDate: "2026-09-01", condition: "")
        let sold = app.inventory.first { $0.id == item.id }
        XCTAssertEqual(sold?.status, "Sold")
        XCTAssertEqual(sold?.previousStatus, "For sale")
        XCTAssertEqual(sold?.soldPrice, 75)
        XCTAssertTrue(app.isLocal(itemId: item.id))

        XCTAssertEqual(app.restoreSold(item.id), "For sale")
        let restored = app.inventory.first { $0.id == item.id }
        XCTAssertEqual(restored?.status, "For sale")
        XCTAssertNil(restored?.soldPrice)
    }

    func testMarkingSoldWithABlankPriceKeepsItBlank() async {
        let app = await signedInSample()
        guard let item = app.activeInventory.first else { return XCTFail() }
        app.markSold(item.id, soldPrice: "", soldDate: "2026-09-01", condition: "")
        XCTAssertNil(app.inventory.first { $0.id == item.id }?.soldPrice)
    }

    func testDeletingHidesTheItemOnlyHere() async {
        let app = await signedInSample()
        let before = app.inventory.count
        guard let item = app.inventory.first else { return XCTFail() }
        app.deleteItem(item.id)
        XCTAssertEqual(app.inventory.count, before - 1)
        app.overlay.revertAll()
        XCTAssertEqual(app.inventory.count, before)
    }

    func testANewItemGetsTheNextReferenceNumber() async {
        let app = await signedInSample()
        let highest = app.inventory.compactMap(\.referenceNumber).max() ?? 0
        let added = app.addItem(Item(id: "", name: "New find"), itemPhotos: [], receiptPhotos: [])
        XCTAssertEqual(added?.referenceNumber, highest + 1)
        XCTAssertEqual(app.inventory.first?.name, "New find", "a new item comes first")
    }

    func testEditingKeepsTheEstimateNilWhenLeftBlank() async {
        let app = await signedInSample()
        guard var item = app.activeInventory.first(where: { $0.estimatedValue != nil }) else { return XCTFail() }
        item.estimatedValue = nil
        app.saveEdit(item, itemPhotos: item.itemPhotos, receiptPhotos: item.receiptPhotos, addedPhotoCount: 0)
        XCTAssertNil(app.inventory.first { $0.id == item.id }?.estimatedValue)
    }
}
