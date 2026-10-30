import Foundation

// Everything a collector can change, applied to the in-memory overlay and
// never sent anywhere. Each action builds the row the web's write would have
// produced -- same columns, same sale-field rules -- so a local change looks
// exactly like a saved one, and says what the web says in its toast.
extension AppModel {
    // MARK: Reading the merged rows

    var mergedInventoryRows: [InventoryRow] {
        overlay.mergedInventory(inventoryRows)
    }

    func row(for itemId: String) -> InventoryRow? {
        mergedInventoryRows.first { $0.id == itemId }
    }

    var activeInventory: [Item] { inventory.filter { $0.status != "Sold" } }
    var soldInventory: [Item] { inventory.filter { $0.status == "Sold" } }

    // nextReferenceNumbers: the next number after the highest one in use,
    // across live and local rows. The web asks the database for its max; the
    // phone has every row in memory already.
    func nextReferenceNumber() -> Int {
        (mergedInventoryRows.compactMap(\.referenceNumber).max() ?? 0) + 1
    }

    private var nowIso: String { ISO8601DateFormatter().string(from: Date()) }

    // MARK: Item lifecycle

    // updateInventoryItem: the edit modal's save.
    func saveEdit(_ draft: Item, itemPhotos: [Photo], receiptPhotos: [Photo], addedPhotoCount: Int) {
        guard let current = row(for: draft.id), let userId = profile?.id else { return }
        let currentItem = Mapping.fromDbItem(current)

        let isNowSold = draft.status == "Sold"
        let wasAlreadySold = currentItem.status == "Sold"
        let previousStatus: String? = !isNowSold ? nil : wasAlreadySold ? (currentItem.previousStatus.isEmpty ? "Owned" : currentItem.previousStatus) : (currentItem.status.isEmpty ? "Owned" : currentItem.status)

        var write = Mapping.toDbItem(draft, userId: userId, itemPhotoCount: itemPhotos.count, receiptPhotoCount: receiptPhotos.count)
        write.referenceNumber = current.referenceNumber
        write.previousStatus = previousStatus
        write.soldPrice = isNowSold ? draft.soldPrice : nil
        write.soldDate = isNowSold && !draft.soldDate.isEmpty ? draft.soldDate : nil

        let updated = Mapping.row(
            from: write, id: current.id, itemPhotos: itemPhotos, receiptPhotos: receiptPhotos,
            hiddenFromShare: draft.hiddenFromShare, createdAt: current.createdAt ?? nowIso, updatedAt: nowIso
        )
        overlay.saveItem(updated, isNew: false, summary: "Edited \"\(label(draft.name))\"")
        toasts.push("Changes saved.", tone: .success)
    }

    func markSold(_ itemId: String, soldPrice: String, soldDate: String, condition: String) {
        guard var updated = row(for: itemId) else { return }
        let previous = Mapping.fromDbItem(updated)
        let statusToRestore = previous.status != "Sold" ? previous.status : (previous.previousStatus.isEmpty ? "Owned" : previous.previousStatus)

        updated.status = "Sold"
        updated.previousStatus = statusToRestore
        updated.soldPrice = Format.optionalAmount(soldPrice)
        updated.soldDate = soldDate.isEmpty ? nil : soldDate
        updated.condition = condition.isEmpty ? previous.condition : condition
        updated.updatedAt = nowIso
        overlay.saveItem(updated, isNew: false, summary: "Marked \"\(label(previous.name))\" sold")
        toasts.push(Format.hasValue(soldPrice) ? "Marked sold for \(Format.currency(soldPrice))." : "Marked sold.", tone: .success)
    }

    // Restoring a sold item returns it to the status it had before the sale,
    // not to "Owned".
    @discardableResult
    func restoreSold(_ itemId: String) -> String? {
        guard var updated = row(for: itemId) else { return nil }
        let previous = Mapping.fromDbItem(updated)
        let restored = previous.previousStatus.isEmpty ? "Owned" : previous.previousStatus

        updated.status = restored
        updated.previousStatus = nil
        updated.soldPrice = nil
        updated.soldDate = nil
        updated.updatedAt = nowIso
        overlay.saveItem(updated, isNew: false, summary: "Restored \"\(label(previous.name))\" to \(restored)")
        toasts.push("Restored to \(restored).", tone: .success)
        return restored
    }

    func deleteItem(_ itemId: String) {
        guard let current = row(for: itemId) else { return }
        let name = current.name ?? ""
        overlay.discardItem(id: itemId, summary: "Deleted \"\(label(name))\"")
        toasts.push("Deleted \"\(name.isEmpty ? "item" : name)\".", tone: .success)
    }

    // updateItemFields: the records view's inline edits, through csvUpdateRow.
    func inlineSave(_ itemId: String, fields: [String: String]) {
        guard let current = row(for: itemId) else { return }
        var enriched = fields
        if fields["status"] == "Sold", (current.soldDate ?? "").isEmpty { enriched["soldDate"] = Format.todayIso() }
        let updated = Mapping.csvUpdatedRow(current, fields: enriched)
        overlay.saveItem(updated, isNew: false, summary: "Edited \"\(label(current.name ?? ""))\"")
    }

    // A new item, as saveQuickItem / the tutorial would insert it.
    @discardableResult
    func addItem(_ item: Item, itemPhotos: [Photo], receiptPhotos: [Photo]) -> Item? {
        guard let userId = profile?.id else { return nil }
        var numbered = item
        numbered.referenceNumber = nextReferenceNumber()
        let write = Mapping.toDbItem(numbered, userId: userId, itemPhotoCount: itemPhotos.count, receiptPhotoCount: receiptPhotos.count)
        let row = Mapping.row(
            from: write, id: UUID().uuidString.lowercased(), itemPhotos: itemPhotos, receiptPhotos: receiptPhotos,
            hiddenFromShare: false, createdAt: nowIso, updatedAt: nowIso
        )
        overlay.saveItem(row, isNew: true, summary: "Added \"\(label(item.name))\"")
        return Mapping.fromDbItem(row)
    }

    // MARK: Sharing

    // shareSettings as the dialog sees them: the saved row, or the defaults
    // when there isn't one yet. nil until the read has landed, as on the web.
    var shareSettingsOrDefault: ShareSettings? {
        if let settings = shareSettings { return settings }
        if case .loaded = shareLoad { return ShareSettings() }
        if case .failed = shareLoad { return ShareSettings() }
        return nil
    }

    func saveShare(_ draft: ShareSettings) {
        guard let userId = profile?.id else { return }
        let slug = (shareSettings?.slug).flatMap { $0.isEmpty ? nil : $0 } ?? PublicCollection.generateSlug()
        let write = Mapping.toDbShareRow(draft, userId: userId, slug: slug)
        overlay.saveShare(row(from: write), summary: draft.visibility == "off" ? "Turned your page off" : "Published your page")
        toasts.push(draft.visibility == "off" ? "Your page is off. The link no longer opens." : "Your collection page is live.", tone: .success)
    }

    func resetShareLink() {
        guard let userId = profile?.id, let settings = shareSettings else { return }
        let write = Mapping.toDbShareRow(settings, userId: userId, slug: PublicCollection.generateSlug())
        overlay.saveShare(row(from: write), summary: "Made a new link for your page")
        toasts.push("New link created. The old one no longer works.", tone: .success)
    }

    private func row(from write: ShareWrite) -> SharedCollectionRow {
        SharedCollectionRow(
            userId: write.userId, slug: write.slug, visibility: write.visibility, title: write.title, blurb: write.blurb,
            showEstimatedValue: write.showEstimatedValue, showPrices: write.showPrices, showProvenance: write.showProvenance,
            showNotes: write.showNotes, showSold: write.showSold, showWishlist: write.showWishlist,
            showOnExplore: write.showOnExplore, exploreItemIds: write.exploreItemIds,
            firstPublishedAt: shareRowLive?.firstPublishedAt, createdAt: shareRowLive?.createdAt ?? nowIso, updatedAt: nowIso
        )
    }

    private func label(_ name: String) -> String {
        name.isEmpty ? "Untitled item" : name
    }
}
