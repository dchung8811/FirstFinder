import Foundation
import Observation

// Every change a reviewer makes in the prototype -- add, edit, mark sold,
// restore, delete, want, found it, share toggles, account toggles, feedback --
// lands here, in memory, on top of the rows the store read. Nothing in this
// type can reach the network, and nothing in it is saved: it is created empty
// at launch, so quitting the app throws every change away.
//
// It works on rows rather than on the screens' models so that a local item is
// built the same way a saved one is (toDbItem, then fromDbItem), and the
// screens can't tell the two apart except by the "local" chip.
@MainActor
@Observable
final class LocalOverlay {
    struct Change: Identifiable, Hashable {
        enum Entity: Hashable {
            case item(String)
            case want(String)
            case share
            case account(String)
            case feedback(String)
        }

        let id = UUID()
        let entity: Entity
        let summary: String
        let at: Date
    }

    // Rows added or changed on this phone, by id.
    private(set) var itemRows: [String: InventoryRow] = [:]
    private(set) var addedItemIds: Set<String> = []
    private(set) var deletedItemIds: Set<String> = []

    private(set) var wantRows: [String: WishlistRow] = [:]
    private(set) var addedWantIds: Set<String> = []
    private(set) var deletedWantIds: Set<String> = []

    private(set) var shareRow: SharedCollectionRow?
    private(set) var accountToggles: [String: Bool] = [:]
    private(set) var accountName: String?
    private(set) var feedback: [FeedbackRow] = []

    // Photo bytes picked on this phone, keyed by a "local/..." path. Memory
    // only, like everything else here.
    private(set) var localPhotos: [String: Data] = [:]

    // What the pending-sync panel lists, newest first.
    private(set) var changes: [Change] = []

    var isEmpty: Bool { changes.isEmpty }

    static let localPhotoPrefix = "local/"

    // MARK: Reading through the overlay

    func mergedInventory(_ live: [InventoryRow]) -> [InventoryRow] {
        let liveIds = Set(live.map(\.id))
        let kept = live
            .filter { !deletedItemIds.contains($0.id) }
            .map { itemRows[$0.id] ?? $0 }
        let added = itemRows.values
            .filter { !liveIds.contains($0.id) && !deletedItemIds.contains($0.id) }
            .sorted { ($0.createdAt ?? "") > ($1.createdAt ?? "") }
        return added + kept
    }

    func mergedWishlist(_ live: [WishlistRow]) -> [WishlistRow] {
        let liveIds = Set(live.map(\.id))
        let kept = live
            .filter { !deletedWantIds.contains($0.id) }
            .map { wantRows[$0.id] ?? $0 }
        let added = wantRows.values
            .filter { !liveIds.contains($0.id) && !deletedWantIds.contains($0.id) }
            .sorted { ($0.createdAt ?? "") > ($1.createdAt ?? "") }
        return added + kept
    }

    func mergedShare(_ live: SharedCollectionRow?) -> SharedCollectionRow? {
        shareRow ?? live
    }

    func mergedFeedback(_ live: [FeedbackRow]) -> [FeedbackRow] {
        feedback + live
    }

    func accountToggle(_ key: String, live: Bool) -> Bool {
        accountToggles[key] ?? live
    }

    func isLocal(itemId: String) -> Bool {
        itemRows[itemId] != nil
    }

    func isLocal(wantId: String) -> Bool {
        wantRows[wantId] != nil
    }

    // MARK: Changing things locally

    func saveItem(_ row: InventoryRow, isNew: Bool, summary: String) {
        itemRows[row.id] = row
        if isNew { addedItemIds.formUnion([row.id]) }
        log(.item(row.id), summary)
    }

    func discardItem(id: String, summary: String) {
        // An item that only ever existed here is simply forgotten; a live one
        // is hidden until relaunch.
        if addedItemIds.contains(id) {
            itemRows[id] = nil
            addedItemIds.subtract([id])
            changes.removeAll { $0.entity == .item(id) }
            return
        }
        itemRows[id] = nil
        deletedItemIds.formUnion([id])
        log(.item(id), summary)
    }

    func saveWant(_ row: WishlistRow, isNew: Bool, summary: String) {
        wantRows[row.id] = row
        if isNew { addedWantIds.formUnion([row.id]) }
        log(.want(row.id), summary)
    }

    func discardWant(id: String, summary: String) {
        if addedWantIds.contains(id) {
            wantRows[id] = nil
            addedWantIds.subtract([id])
            changes.removeAll { $0.entity == .want(id) }
            return
        }
        wantRows[id] = nil
        deletedWantIds.formUnion([id])
        log(.want(id), summary)
    }

    func saveShare(_ row: SharedCollectionRow, summary: String) {
        shareRow = row
        log(.share, summary)
    }

    func setAccountToggle(_ key: String, to value: Bool, summary: String) {
        accountToggles[key] = value
        log(.account(key), summary)
    }

    func setAccountName(_ name: String, summary: String) {
        accountName = name
        log(.account("name"), summary)
    }

    func addFeedback(_ row: FeedbackRow, summary: String) {
        feedback = [row] + feedback
        log(.feedback(row.id), summary)
    }

    func storePhoto(_ data: Data, name: String) -> Photo {
        let path = Self.localPhotoPrefix + UUID().uuidString.lowercased() + "-" + name
        localPhotos[path] = data
        return Photo(path: path, name: name)
    }

    // Photos picked for a draft that was then thrown away.
    func forgetPhotos(_ paths: [String]) {
        for path in paths { localPhotos[path] = nil }
    }

    // MARK: Undoing

    // Puts one entity back exactly as the store read it, dropping every local
    // change to it -- the pending-sync panel's "Discard".
    func revert(_ entity: Change.Entity) {
        switch entity {
        case .item(let id):
            itemRows[id] = nil
            addedItemIds.subtract([id])
            deletedItemIds.subtract([id])
        case .want(let id):
            wantRows[id] = nil
            addedWantIds.subtract([id])
            deletedWantIds.subtract([id])
        case .share:
            shareRow = nil
        case .account(let key):
            accountToggles[key] = nil
            if key == "name" { accountName = nil }
        case .feedback(let id):
            feedback.removeAll { $0.id == id }
        }
        changes.removeAll { $0.entity == entity }
    }

    func revertAll() {
        itemRows = [:]
        addedItemIds = []
        deletedItemIds = []
        wantRows = [:]
        addedWantIds = []
        deletedWantIds = []
        shareRow = nil
        accountToggles = [:]
        accountName = nil
        feedback = []
        localPhotos = [:]
        changes = []
    }

    private func log(_ entity: Change.Entity, _ summary: String) {
        changes = [Change(entity: entity, summary: summary, at: Date())] + changes
    }
}
