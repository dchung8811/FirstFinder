import Foundation

// Port of src/utils/mapping.js: the translation between the camelCase models
// and the snake_case rows. The null-vs-zero handling on estimated_value and
// sold_price lives here and is load-bearing: nil means "no estimate yet",
// 0 means "estimated at nothing".
//
// The prototype never sends a row anywhere. The "to" half exists because the
// in-memory overlay saves an item the way the web would -- toDbItem, then
// fromDbItem -- so a local item is shaped exactly like one that came back
// from Postgres, quirks included.

// The columns toDbItem produces. A separate type rather than an InventoryRow
// because the web's write deliberately leaves out id, the photo arrays and
// hidden_from_share.
struct InventoryWrite: Hashable, Sendable {
    var userId: String
    var referenceNumber: Int?
    var name: String
    var category: String
    var author: String
    var maker: String
    var edition: String
    var bookGenre: String
    var bookEdition: String
    var bookPrinting: String
    var status: String
    var condition: String
    var previousStatus: String?
    var soldPrice: Decimal?
    var soldDate: String?
    var purchaseDate: String?
    var source: String
    var purchasePrice: Decimal
    var estimatedValue: Decimal?
    var notes: String
    var itemPhotoCount: Int
    var receiptPhotoCount: Int
}

struct ShareWrite: Hashable, Sendable {
    var userId: String
    var slug: String
    var visibility: String
    var title: String
    var blurb: String
    var showEstimatedValue: Bool
    var showPrices: Bool
    var showProvenance: Bool
    var showNotes: Bool
    var showSold: Bool
    var showWishlist: Bool
    var showOnExplore: Bool
    var exploreItemIds: [String]
}

struct WantWrite: Hashable, Sendable {
    var userId: String
    var name: String
    var maker: String
    var category: String
    var wantedEdition: String
    var wantedPrinting: String
    var publisher: String
    var minCondition: String
    var jacketRequirement: String
    var signatureRequirement: String
    var maxPrice: Decimal?
    var preferredSource: String
    var priority: String
    var upgradeForItemId: String?
    var notes: String
    var hiddenFromShare: Bool
}

enum Mapping {
    // `x || fallback` on the web: nil and "" both take the fallback.
    private static func or(_ value: String?, _ fallback: String) -> String {
        guard let value, !value.isEmpty else { return fallback }
        return value
    }

    // Books record their edition in book_edition / book_printing and never
    // show the free-text field, so a book always stores it blank. Issue #169.
    static func storedEdition(_ item: Item) -> String {
        item.category == "Book" ? "" : item.edition
    }

    static func toDbItem(_ item: Item, userId: String, itemPhotoCount: Int = 0, receiptPhotoCount: Int = 0) -> InventoryWrite {
        let sold = item.status == "Sold"
        return InventoryWrite(
            userId: userId,
            referenceNumber: item.referenceNumber,
            name: item.name,
            category: or(item.category, "Other"),
            author: item.author,
            maker: item.maker,
            edition: storedEdition(item),
            bookGenre: item.bookGenre,
            bookEdition: item.bookEdition,
            bookPrinting: item.bookPrinting,
            status: or(item.status, "Owned"),
            condition: item.condition,
            // An item created already "Sold" captures its sale fields the
            // same way an existing item marked sold would.
            previousStatus: sold ? "Owned" : nil,
            soldPrice: sold ? item.soldPrice : nil,
            soldDate: sold ? (item.soldDate.isEmpty ? nil : item.soldDate) : nil,
            purchaseDate: item.purchaseDate.isEmpty ? nil : item.purchaseDate,
            source: item.source,
            // The web stores toNumber(purchasePrice): a blank purchase price
            // is saved as 0 paid. Unlike the estimate, this one has always
            // collapsed blank to zero, and the port keeps that.
            purchasePrice: Format.toNumber(item.purchasePrice),
            estimatedValue: item.estimatedValue,
            notes: item.notes,
            itemPhotoCount: itemPhotoCount,
            receiptPhotoCount: receiptPhotoCount
        )
    }

    static func fromDbPhotoList(_ column: PhotoColumn) -> [Photo] {
        column.records.compactMap { record in
            guard let path = record.path, !path.isEmpty else { return nil }
            return Photo(path: path, name: or(record.name, "photo"))
        }
    }

    static func fromDbItem(_ row: InventoryRow, now: Date = Date()) -> Item {
        let itemPhotos = fromDbPhotoList(row.itemPhotos)
        let receiptPhotos = fromDbPhotoList(row.receiptPhotos)

        return Item(
            id: row.id,
            referenceNumber: row.referenceNumber,
            name: row.name ?? "",
            category: or(row.category, "Other"),
            author: row.author ?? "",
            maker: row.maker ?? "",
            edition: row.edition ?? "",
            bookGenre: row.bookGenre ?? "",
            bookEdition: row.bookEdition ?? "",
            bookPrinting: row.bookPrinting ?? "",
            status: or(row.status, "Owned"),
            condition: row.condition ?? "",
            purchaseDate: row.purchaseDate ?? "",
            source: row.source ?? "",
            purchasePrice: row.purchasePrice,
            estimatedValue: row.estimatedValue,
            previousStatus: row.previousStatus ?? "",
            soldPrice: row.soldPrice,
            soldDate: row.soldDate ?? "",
            notes: row.notes ?? "",
            // Not written by toDbItem: toggled on its own, so a normal item
            // save can't quietly re-share something the owner hid.
            hiddenFromShare: row.hiddenFromShare ?? false,
            // The real photo records win over a stale count.
            itemPhotoCount: itemPhotos.isEmpty ? (row.itemPhotoCount ?? 0) : itemPhotos.count,
            receiptPhotoCount: receiptPhotos.isEmpty ? (row.receiptPhotoCount ?? 0) : receiptPhotos.count,
            itemPhotos: itemPhotos,
            receiptPhotos: receiptPhotos,
            savedAt: or(row.createdAt, or(row.updatedAt, ISO8601DateFormatter().string(from: now)))
        )
    }

    // An InventoryRow as the database would hand back the write: the write's
    // columns, plus the identity, photo and share columns the write leaves
    // alone. Used only by the overlay.
    static func row(
        from write: InventoryWrite,
        id: String,
        itemPhotos: [Photo],
        receiptPhotos: [Photo],
        hiddenFromShare: Bool,
        createdAt: String,
        updatedAt: String
    ) -> InventoryRow {
        InventoryRow(
            id: id,
            userId: write.userId,
            referenceNumber: write.referenceNumber,
            name: write.name,
            category: write.category,
            author: write.author,
            maker: write.maker,
            edition: write.edition,
            bookGenre: write.bookGenre,
            bookEdition: write.bookEdition,
            bookPrinting: write.bookPrinting,
            status: write.status,
            condition: write.condition,
            purchaseDate: write.purchaseDate,
            source: write.source,
            purchasePrice: write.purchasePrice,
            estimatedValue: write.estimatedValue,
            previousStatus: write.previousStatus,
            soldPrice: write.soldPrice,
            soldDate: write.soldDate,
            notes: write.notes,
            hiddenFromShare: hiddenFromShare,
            itemPhotos: PhotoColumn(records: itemPhotos.map { .init(path: $0.path, name: $0.name) }),
            receiptPhotos: PhotoColumn(records: receiptPhotos.map { .init(path: $0.path, name: $0.name) }),
            itemPhotoCount: write.itemPhotoCount,
            receiptPhotoCount: write.receiptPhotoCount,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }

    // MARK: shared_collections

    static func fromDbShareSettings(_ row: SharedCollectionRow) -> ShareSettings {
        ShareSettings(
            slug: row.slug ?? "",
            visibility: or(row.visibility, "off"),
            title: row.title ?? "",
            blurb: row.blurb ?? "",
            showEstimatedValue: row.showEstimatedValue ?? false,
            showPrices: row.showPrices ?? false,
            showProvenance: row.showProvenance ?? false,
            showNotes: row.showNotes ?? false,
            showSold: row.showSold ?? false,
            showWishlist: row.showWishlist ?? false,
            showOnExplore: row.showOnExplore ?? false,
            exploreItemIds: normalizeExplorePicks(row.exploreItemIds)
        )
    }

    static func toDbShareRow(_ settings: ShareSettings, userId: String, slug: String) -> ShareWrite {
        ShareWrite(
            userId: userId,
            slug: slug,
            visibility: or(settings.visibility, "off"),
            title: settings.title.trimmingCharacters(in: .whitespacesAndNewlines),
            blurb: settings.blurb.trimmingCharacters(in: .whitespacesAndNewlines),
            showEstimatedValue: settings.showEstimatedValue,
            showPrices: settings.showPrices,
            showProvenance: settings.showProvenance,
            showNotes: settings.showNotes,
            showSold: settings.showSold,
            showWishlist: settings.showWishlist,
            // Never stored as on for a page that isn't listed, or it would
            // turn back on by itself the day the owner lists the page.
            showOnExplore: settings.visibility == "listed" && settings.showOnExplore,
            exploreItemIds: normalizeExplorePicks(settings.exploreItemIds)
        )
    }

    // Port of normalizeExplorePicks in src/utils/explore.js.
    static let exploreStripLimit = 8

    static func normalizeExplorePicks(_ ids: [String]?, limit: Int = exploreStripLimit) -> [String] {
        guard let ids else { return [] }
        var seen = Set<String>()
        var picks: [String] = []
        for id in ids where !id.isEmpty && !seen.contains(id) {
            seen.formUnion([id])
            picks.append(id)
            if picks.count >= limit { break }
        }
        return picks
    }

    // MARK: wishlist_items

    static func fromDbWant(_ row: WishlistRow) -> Want {
        Want(
            id: row.id,
            name: row.name ?? "",
            maker: row.maker ?? "",
            category: or(row.category, "Book"),
            wantedEdition: row.wantedEdition ?? "",
            wantedPrinting: row.wantedPrinting ?? "",
            publisher: row.publisher ?? "",
            minCondition: row.minCondition ?? "",
            jacketRequirement: or(row.jacketRequirement, "any"),
            signatureRequirement: or(row.signatureRequirement, "any"),
            maxPrice: row.maxPrice,
            preferredSource: row.preferredSource ?? "",
            priority: or(row.priority, "hunting"),
            upgradeForItemId: row.upgradeForItemId ?? "",
            notes: row.notes ?? "",
            hiddenFromShare: row.hiddenFromShare ?? false,
            foundAt: row.foundAt ?? "",
            foundItemId: row.foundItemId ?? "",
            createdAt: row.createdAt ?? "",
            updatedAt: row.updatedAt ?? ""
        )
    }

    static func toDbWant(_ want: Want, userId: String) -> WantWrite {
        WantWrite(
            userId: userId,
            name: want.name.trimmingCharacters(in: .whitespacesAndNewlines),
            maker: want.maker.trimmingCharacters(in: .whitespacesAndNewlines),
            category: or(want.category, "Book"),
            wantedEdition: want.wantedEdition,
            wantedPrinting: want.wantedPrinting,
            publisher: want.publisher,
            minCondition: want.minCondition,
            jacketRequirement: or(want.jacketRequirement, "any"),
            signatureRequirement: or(want.signatureRequirement, "any"),
            maxPrice: want.maxPrice,
            preferredSource: want.preferredSource,
            priority: or(want.priority, "hunting"),
            // A blank select becomes nil: the column is a uuid foreign key.
            upgradeForItemId: want.upgradeForItemId.isEmpty ? nil : want.upgradeForItemId,
            notes: want.notes,
            hiddenFromShare: want.hiddenFromShare
        )
    }

    // MARK: site_banner (port of fromDbBanner in src/utils/siteBanner.js)

    static func fromDbBanner(_ row: SiteBannerRow?) -> SiteBanner {
        guard let row else { return SiteBanner() }
        return SiteBanner(
            enabled: row.enabled == true,
            message: row.message ?? "",
            linkLabel: row.linkLabel ?? "",
            linkView: row.linkView ?? "",
            updatedAt: (row.updatedAt?.isEmpty ?? true) ? nil : row.updatedAt
        )
    }

    static func bannerDismissalId(_ banner: SiteBanner) -> String {
        banner.updatedAt ?? ""
    }

    static func shouldShowBanner(_ banner: SiteBanner, dismissedId: String?) -> Bool {
        guard banner.enabled, !banner.message.isEmpty else { return false }
        let id = bannerDismissalId(banner)
        return id.isEmpty || id != dismissedId
    }
}
