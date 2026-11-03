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

// The collection's actions, end to end through the sample store, which saves
// in memory the way the database would. Each test checks the save reached the
// store -- a fresh read agrees -- not just that the screen changed.
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
        let marked = await app.markSold(item.id, soldPrice: "75", soldDate: "2026-09-01", condition: "")
        XCTAssertTrue(marked)
        let sold = app.inventory.first { $0.id == item.id }
        XCTAssertEqual(sold?.status, "Sold")
        XCTAssertEqual(sold?.previousStatus, "For sale")
        XCTAssertEqual(sold?.soldPrice, 75)

        await app.refreshInventory()
        XCTAssertEqual(app.inventory.first { $0.id == item.id }?.status, "Sold", "the sale was saved, not just shown")

        let restored = await app.restoreSold(item.id)
        XCTAssertEqual(restored, "For sale")
        let back = app.inventory.first { $0.id == item.id }
        XCTAssertEqual(back?.status, "For sale")
        XCTAssertNil(back?.soldPrice)
        XCTAssertEqual(back?.previousStatus, "")
    }

    func testMarkingSoldWithABlankPriceKeepsItBlank() async {
        let app = await signedInSample()
        guard let item = app.activeInventory.first else { return XCTFail() }
        await app.markSold(item.id, soldPrice: "", soldDate: "2026-09-01", condition: "")
        XCTAssertNil(app.inventory.first { $0.id == item.id }?.soldPrice)
    }

    func testDeletingRemovesTheItemForGood() async {
        let app = await signedInSample()
        let before = app.inventory.count
        guard let item = app.inventory.first else { return XCTFail() }
        let deleted = await app.deleteItem(item.id)
        XCTAssertTrue(deleted)
        XCTAssertEqual(app.inventory.count, before - 1)
        await app.refreshInventory()
        XCTAssertEqual(app.inventory.count, before - 1)
        XCTAssertNil(app.inventory.first { $0.id == item.id })
    }

    func testANewItemGetsTheNextReferenceNumber() async {
        let app = await signedInSample()
        let highest = app.inventory.compactMap(\.referenceNumber).max() ?? 0
        let added = await app.addItem(Item(id: "", name: "New find"), itemPhotos: [], receiptPhotos: [])
        XCTAssertEqual(added?.referenceNumber, highest + 1)
        XCTAssertEqual(app.inventory.first?.name, "New find", "a new item comes first")
        XCTAssertEqual(app.toasts.toasts.last?.message, "Saved to your collection.")
    }

    // A picked photo is uploaded under the owner's folder for the new item,
    // linked to the row, and then forgotten from memory.
    func testANewItemsPhotosAreUploadedAndLinked() async {
        let app = await signedInSample()
        let picked = app.pendingPhotos.store(Data([0xFF, 0xD8, 0xFF]), name: "cover.jpg")
        guard let added = await app.addItem(Item(id: "", name: "With a photo"), itemPhotos: [picked], receiptPhotos: []) else { return XCTFail() }
        let userId = app.profile?.id ?? ""
        XCTAssertEqual(added.itemPhotos.count, 1)
        XCTAssertTrue(added.itemPhotos[0].path.hasPrefix("\(userId)/\(added.id)/item-"), added.itemPhotos[0].path)
        XCTAssertEqual(added.itemPhotoCount, 1)
        XCTAssertTrue(app.pendingPhotos.bytes.isEmpty)
    }

    func testEditingKeepsTheEstimateNilWhenLeftBlank() async {
        let app = await signedInSample()
        guard var item = app.activeInventory.first(where: { $0.estimatedValue != nil }) else { return XCTFail() }
        item.estimatedValue = nil
        let saved = await app.saveEdit(item, itemPhotos: item.itemPhotos, receiptPhotos: item.receiptPhotos)
        XCTAssertTrue(saved)
        await app.refreshInventory()
        XCTAssertNil(app.inventory.first { $0.id == item.id }?.estimatedValue)
    }

    func testAnInlineEditWritesOnlyThatField() async {
        let app = await signedInSample()
        guard let item = app.activeInventory.first(where: { !$0.notes.isEmpty }) ?? app.activeInventory.first else { return XCTFail() }
        await app.inlineSave(item.id, fields: ["name": "Renamed"])
        let after = app.inventory.first { $0.id == item.id }
        XCTAssertEqual(after?.name, "Renamed")
        XCTAssertEqual(after?.notes, item.notes)
        XCTAssertEqual(after?.estimatedValue, item.estimatedValue)
    }

    // A refused save leaves the screen as it was and says what happened.
    func testAFailedSaveChangesNothing() async {
        let app = await signedInSample()
        guard let item = app.activeInventory.first else { return XCTFail() }
        app.sampleStore.scenario = .failing
        let marked = await app.markSold(item.id, soldPrice: "10", soldDate: "", condition: "")
        XCTAssertFalse(marked)
        XCTAssertEqual(app.inventory.first { $0.id == item.id }?.status, item.status)
        XCTAssertEqual(app.toasts.toasts.last?.tone, .error)
    }

    func testSavingNeedsAConnection() async {
        let app = await signedInSample()
        guard let item = app.activeInventory.first else { return XCTFail() }
        app.forceOffline = true
        let deleted = await app.deleteItem(item.id)
        XCTAssertFalse(deleted)
        XCTAssertNotNil(app.inventory.first { $0.id == item.id })
        XCTAssertEqual(app.toasts.toasts.last?.message, AppModel.offlineSaveMessage)
    }
}
