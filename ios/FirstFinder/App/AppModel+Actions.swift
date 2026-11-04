import Foundation

// Everything a collector can change, saved through the store the way
// app/InventoryApp.jsx saves it: the same order of steps, the same rows (see
// Writes.swift), and the same words in the toast afterwards. Each action
// changes what's on screen only once the save has landed, to the row that
// came back.
//
// Saving needs a connection. The web can queue edits offline; the phone's
// first release doesn't, and says so instead of pretending to save.
extension AppModel {
    var activeInventory: [Item] { inventory.filter { $0.status != "Sold" } }
    var soldInventory: [Item] { inventory.filter { $0.status == "Sold" } }

    func row(for itemId: String) -> InventoryRow? {
        inventoryRows.first { $0.id == itemId }
    }

    static let offlineSaveMessage = "You're offline, so that can't be saved yet. Try again when you have a connection."

    // MARK: Adding

    // insertItemWithPhotos: a reference number, the row, then its photos.
    // The row is saved first, so a failed photo never costs the collector the
    // item -- the photos are reported separately, and differently depending
    // on whether they failed to upload or failed to link.
    @discardableResult
    func addItem(_ item: Item, itemPhotos: [Photo], receiptPhotos: [Photo], announce: Bool = true) async -> Item? {
        guard let userId = profile?.id else {
            toasts.push("Please log in before saving to your collection.", tone: .error)
            return nil
        }
        guard isOnline else {
            toasts.push(Self.offlineSaveMessage, tone: .error)
            return nil
        }
        isSaving = true
        defer { isSaving = false }

        let inserted: InventoryRow
        do {
            inserted = try await insertNumbered(item, userId: userId, itemPhotoCount: itemPhotos.count, receiptPhotoCount: receiptPhotos.count)
        } catch {
            toasts.push(error.localizedDescription, tone: .error)
            return nil
        }

        var saved = inserted
        var uploadFailures: [String] = []
        var photoLinkFailed = false

        if !itemPhotos.isEmpty || !receiptPhotos.isEmpty {
            let items = await upload(itemPhotos, folder: inserted.id, kind: "item")
            let receipts = await upload(receiptPhotos, folder: inserted.id, kind: "receipt")
            uploadFailures = items.failures + receipts.failures
            // Retried: the files are in storage and their paths in hand, so
            // the same update can simply be sent again after a gateway blip.
            let store = store
            let link = Writes.photoLink(itemPhotos: items.uploaded, receiptPhotos: receipts.uploaded)
            do {
                saved = try await WriteRetry.run { try await store.updateItem(id: inserted.id, link) }
            } catch {
                photoLinkFailed = true
            }
        }

        if item.category == "Book" {
            let title = item.name.trimmingCharacters(in: .whitespaces)
            if title.count >= 3 {
                let store = store
                let maker = item.maker.trimmingCharacters(in: .whitespaces)
                Task { await store.queueBookSuggestion(title: title, author: maker) }
            }
        }

        took(item: saved)

        if photoLinkFailed {
            // Deliberately says NOT to re-add: the photos are in storage, and
            // re-adding uploads duplicates.
            toasts.push(
                uploadFailures.isEmpty
                    ? "Item saved and your photos uploaded, but linking them to the item didn't save. They're safe in storage -- open the item and save again to attach them. Don't re-add them or you'll upload duplicates."
                    : "Item saved. Some photos failed to upload (\(uploadFailures.joined(separator: ", "))), and the ones that did upload could not be linked to the item. Open the item and save again to attach them -- don't re-add them or you'll upload duplicates.",
                tone: .warning
            )
        } else if !uploadFailures.isEmpty {
            toasts.push("Item saved, but some photos failed to upload: \(uploadFailures.joined(separator: ", ")). Re-add those photos from Edit.", tone: .warning)
        } else if announce {
            toasts.push("Saved to your collection.", tone: .success)
        }
        return Mapping.fromDbItem(saved)
    }

    // nextReferenceNumbers, then the insert. The number comes from the
    // database's current max, and the unique (user_id, reference_number) index
    // is the backstop: if another device took the number in between, ask
    // again rather than fail.
    private func insertNumbered(_ item: Item, userId: String, itemPhotoCount: Int, receiptPhotoCount: Int) async throws -> InventoryRow {
        var attempt = 0
        while true {
            var numbered = item
            numbered.referenceNumber = try await store.maxReferenceNumber(userId: userId) + 1
            let payload = Writes.itemInsert(Mapping.toDbItem(numbered, userId: userId, itemPhotoCount: itemPhotoCount, receiptPhotoCount: receiptPhotoCount))
            do {
                guard let row = try await store.insertItems([payload]).first else {
                    throw StoreError.write("The item didn't come back from the save.", code: WriteRetry.noRowWrittenCode)
                }
                return row
            } catch StoreError.write(let message, code: "23505") where attempt < 2 {
                _ = message
                attempt += 1
            }
        }
    }

    // uploadPhotoList: each pending photo compressed and stored under the
    // owner's folder. Photos already in storage pass straight through.
    func upload(_ photos: [Photo], folder: String, kind: String) async -> (uploaded: [Photo], failures: [String]) {
        guard let userId = profile?.id else { return ([], photos.map(\.name)) }
        var uploaded: [Photo] = []
        var failures: [String] = []
        for photo in photos {
            guard PendingPhotos.isPending(photo) else {
                uploaded.append(photo)
                continue
            }
            guard let original = pendingPhotos.bytes[photo.path] else {
                failures.append(photo.name)
                continue
            }
            let jpeg = await Task.detached(priority: .userInitiated) { PhotoCompression.jpeg(original) }.value
            let path = Writes.photoPath(userId: userId, itemId: folder, kind: kind, name: photo.name)
            do {
                try await store.uploadPhoto(path: path, jpeg: jpeg)
                uploaded.append(Photo(path: path, name: photo.name))
                pendingPhotos.forget([photo.path])
            } catch {
                failures.append(photo.name)
            }
        }
        return (uploaded, failures)
    }

    // MARK: Editing

    // updateInventoryItem: new photos uploaded, removed ones deleted from
    // storage, then the whole item saved. `itemPhotos` and `receiptPhotos` are
    // the lists as the form left them: kept photos plus any just picked.
    @discardableResult
    func saveEdit(_ draft: Item, itemPhotos: [Photo], receiptPhotos: [Photo]) async -> Bool {
        guard profile != nil, let current = row(for: draft.id).map({ Mapping.fromDbItem($0) }) else { return false }
        guard isOnline else {
            toasts.push(Self.offlineSaveMessage, tone: .error)
            return false
        }
        isSaving = true
        defer { isSaving = false }

        let items = await upload(itemPhotos, folder: draft.id, kind: "item")
        let receipts = await upload(receiptPhotos, folder: draft.id, kind: "receipt")
        let uploadedAny = items.uploaded.contains { !current.itemPhotos.contains($0) }
            || receipts.uploaded.contains { !current.receiptPhotos.contains($0) }

        let keptPaths = Set((itemPhotos + receiptPhotos).map(\.path))
        let removed = (current.itemPhotos + current.receiptPhotos).map(\.path).filter { !keptPaths.contains($0) }
        if !removed.isEmpty { try? await store.removePhotos(paths: removed) }

        let store = store
        let payload = Writes.itemUpdate(draft: draft, current: current, itemPhotos: items.uploaded, receiptPhotos: receipts.uploaded)
        do {
            let saved = try await WriteRetry.run { try await store.updateItem(id: draft.id, payload) }
            took(item: saved)
        } catch {
            toasts.push(
                uploadedAny
                    ? "Your changes didn't save. Any photos you added are already in storage -- open the item and save again rather than re-adding them, which would upload duplicates."
                    : error.localizedDescription,
                tone: .error
            )
            return false
        }

        let failures = items.failures + receipts.failures
        if failures.isEmpty {
            toasts.push("Changes saved.", tone: .success)
        } else {
            toasts.push("Changes saved, but some new photos failed to upload: \(failures.joined(separator: ", ")). Re-add those photos from Edit.", tone: .warning)
        }
        return true
    }

    @discardableResult
    func markSold(_ itemId: String, soldPrice: String, soldDate: String, condition: String) async -> Bool {
        guard let current = row(for: itemId).map({ Mapping.fromDbItem($0) }) else { return false }
        let payload = Writes.markSold(current: current, soldPrice: soldPrice, soldDate: soldDate, condition: condition)
        guard await save(itemId, payload) else { return false }
        toasts.push(Format.hasValue(soldPrice) ? "Marked sold for \(Format.currency(soldPrice))." : "Marked sold.", tone: .success)
        return true
    }

    // Restoring a sold item returns it to the status it had before the sale,
    // not to "Owned".
    @discardableResult
    func restoreSold(_ itemId: String) async -> String? {
        guard let current = row(for: itemId).map({ Mapping.fromDbItem($0) }) else { return nil }
        let (payload, restored) = Writes.restore(current: current)
        guard await save(itemId, payload) else { return nil }
        toasts.push("Restored to \(restored).", tone: .success)
        return restored
    }

    // updateItemFields: the records view's inline edits. Moving an item to
    // Sold there defaults the sale date to today, as the edit form does.
    func inlineSave(_ itemId: String, fields: [String: String]) async {
        guard let current = row(for: itemId).map({ Mapping.fromDbItem($0) }) else { return }
        var enriched = fields
        if fields["status"] == "Sold", current.soldDate.isEmpty { enriched["soldDate"] = Format.todayIso() }
        await save(itemId, Writes.fieldUpdate(current: current, fields: enriched))
    }

    // One update by id, taken back into the rows. Not retried: these aren't
    // the writes that strand uploaded photos when they fail.
    @discardableResult
    private func save(_ itemId: String, _ payload: RowPayload) async -> Bool {
        guard isOnline else {
            toasts.push(Self.offlineSaveMessage, tone: .error)
            return false
        }
        isSaving = true
        defer { isSaving = false }
        do {
            took(item: try await store.updateItem(id: itemId, payload))
            return true
        } catch {
            toasts.push(error.localizedDescription, tone: .error)
            return false
        }
    }

    // MARK: Deleting

    // The row first; then, best effort, everything stored in its photo
    // folder -- listed from storage rather than taken from the row, which
    // isn't a complete record of what was uploaded for it.
    @discardableResult
    func deleteItem(_ itemId: String) async -> Bool {
        guard let userId = profile?.id, let current = row(for: itemId) else { return false }
        guard isOnline else {
            toasts.push(Self.offlineSaveMessage, tone: .error)
            return false
        }
        isSaving = true
        defer { isSaving = false }
        do {
            try await store.deleteItem(id: itemId)
        } catch {
            toasts.push(error.localizedDescription, tone: .error)
            return false
        }
        let rowPaths = (current.itemPhotos.records + current.receiptPhotos.records).compactMap(\.path)
        let paths = await store.listItemPhotoPaths(userId: userId, itemId: itemId) ?? rowPaths
        try? await store.removePhotos(paths: paths)

        dropped(itemId: itemId)
        let name = current.name ?? ""
        toasts.push("Deleted \"\(name.isEmpty ? "item" : name)\".", tone: .success)
        return true
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

    @discardableResult
    func saveShare(_ draft: ShareSettings) async -> Bool {
        let slug = (shareSettings?.slug).flatMap { $0.isEmpty ? nil : $0 } ?? PublicCollection.generateSlug()
        guard await upsertShare(draft, slug: slug) else { return false }
        toasts.push(draft.visibility == "off" ? "Your page is off. The link no longer opens." : "Your collection page is live.", tone: .success)
        return true
    }

    @discardableResult
    func resetShareLink() async -> Bool {
        guard let settings = shareSettings else { return false }
        guard await upsertShare(settings, slug: PublicCollection.generateSlug()) else { return false }
        toasts.push("New link created. The old one no longer works.", tone: .success)
        return true
    }

    private func upsertShare(_ settings: ShareSettings, slug: String) async -> Bool {
        guard let userId = profile?.id else { return false }
        guard isOnline else {
            toasts.push(Self.offlineSaveMessage, tone: .error)
            return false
        }
        isSaving = true
        defer { isSaving = false }
        do {
            took(share: try await store.upsertShareSettings(Writes.share(Mapping.toDbShareRow(settings, userId: userId, slug: slug))))
            return true
        } catch {
            toasts.push(error.localizedDescription, tone: .error)
            return false
        }
    }
}
