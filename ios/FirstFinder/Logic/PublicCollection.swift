import Foundation

// Port of the parts of src/utils/publicCollection.js the share dialog uses:
// what a public page shows, the presets, and which items appear at all.
//
// buildPublicItem keeps the web's shape: a fixed set of shelf fields, then
// each money or provenance field added only when its switch is on. No field
// is copied across wholesale, which is the whole safety property -- receipt
// photos in particular can never appear, under any setting.
enum PublicCollection {
    static let blurbMax = 280

    struct FieldGroup: Hashable, Identifiable {
        var key: WritableKeyPath<ShareSettings, Bool>
        var label: String
        var detail: String
        var warning: String?

        var id: String { label }

        static func == (lhs: FieldGroup, rhs: FieldGroup) -> Bool { lhs.label == rhs.label }
        func hash(into hasher: inout Hasher) { hasher.combine(label) }
    }

    // Key paths aren't Sendable, but these are immutable and only read.
    nonisolated(unsafe) static let fieldGroups: [FieldGroup] = [
        FieldGroup(key: \.showEstimatedValue, label: "What it's worth", detail: "Your estimated value for each item."),
        FieldGroup(key: \.showPrices, label: "What I paid", detail: "Purchase prices, and what sold copies sold for."),
        FieldGroup(key: \.showProvenance, label: "How I got it", detail: "Purchase date and where each item came from."),
        FieldGroup(
            key: \.showNotes, label: "My notes", detail: "Your free-text notes, exactly as written.",
            // Notes are where people record where a book physically lives.
            warning: "Notes often hold storage locations. Check them before turning this on."
        ),
        FieldGroup(key: \.showSold, label: "Sold items", detail: "Include items you've marked sold, showing your trading record."),
        FieldGroup(key: \.showWishlist, label: "Wishlist", detail: "Publish what you're hunting for. Never your maximum price."),
    ]

    struct Preset: Hashable, Identifiable {
        var id: String
        var label: String
        var detail: String
        // estimate, prices, provenance, notes, sold, wishlist
        var flags: [Bool]
    }

    static let presets = [
        Preset(id: "showcase", label: "Showcase", detail: "Titles, editions, condition, and photos. Nothing about money.", flags: [false, false, false, false, false, false]),
        Preset(id: "notes", label: "Collector's notes", detail: "Adds where each item came from and your notes on it.", flags: [false, false, true, true, false, false]),
        Preset(id: "ledger", label: "Full ledger", detail: "Everything, including prices and your sold record.", flags: [true, true, true, true, true, true]),
    ]

    static func flags(_ settings: ShareSettings) -> [Bool] {
        fieldGroups.map { settings[keyPath: $0.key] }
    }

    static func matchingPresetId(_ settings: ShareSettings) -> String? {
        presets.first { $0.flags == flags(settings) }?.id
    }

    static func applyPreset(_ settings: ShareSettings, presetId: String) -> ShareSettings {
        guard let preset = presets.first(where: { $0.id == presetId }) else { return settings }
        var next = settings
        for (group, flag) in zip(fieldGroups, preset.flags) { next[keyPath: group.key] = flag }
        return next
    }

    struct Visibility: Hashable, Identifiable {
        var value: String
        var label: String
        var detail: String
        var id: String { value }
    }

    static let visibilities = [
        Visibility(value: "off", label: "Off", detail: "There is no page. The link returns Not Found for everyone, including anyone you sent it to earlier."),
        Visibility(value: "unlisted", label: "Anyone with the link", detail: "Signed in or not, anyone holding the link can open it. The link can't be guessed — but it isn't secret, and whoever it's forwarded to can read it."),
        Visibility(value: "listed", label: "Listed on search engines", detail: "Everything above, plus Google is invited to index it. Worth knowing: turning this back off takes days to clear from search results."),
    ]

    // isItemShared: membership, separate from which fields show.
    static func isItemShared(_ item: Item, _ settings: ShareSettings) -> Bool {
        if item.hiddenFromShare { return false }
        if item.status == "Sold" { return settings.showSold }
        if item.status == "Wishlist" { return settings.showWishlist }
        return true
    }

    struct PublicItem: Hashable {
        var id: String
        var name: String
        var author: String
        var maker: String
        var category: String
        var edition: String
        var bookEdition: String
        var bookPrinting: String
        var bookGenre: String
        var condition: String
        var status: String
        var photos: [Photo]
        var hasReceipt: Bool
        var estimatedValue: Decimal?
        var purchasePrice: Decimal?
        var soldPrice: Decimal?
        var soldDate: String?
        var purchaseDate: String?
        var source: String?
        var notes: String?
    }

    static func buildPublicItem(_ item: Item, _ settings: ShareSettings) -> PublicItem {
        var publicItem = PublicItem(
            id: item.id, name: item.name, author: item.author, maker: item.maker,
            category: item.category.isEmpty ? "Other" : item.category, edition: item.edition,
            bookEdition: item.bookEdition, bookPrinting: item.bookPrinting, bookGenre: item.bookGenre,
            condition: item.condition, status: item.status.isEmpty ? "Owned" : item.status,
            photos: item.itemPhotos,
            hasReceipt: (item.receiptPhotos.isEmpty ? item.receiptPhotoCount : item.receiptPhotos.count) > 0
        )
        if settings.showEstimatedValue { publicItem.estimatedValue = item.estimatedValue }
        if settings.showPrices {
            publicItem.purchasePrice = item.purchasePrice
            publicItem.soldPrice = item.soldPrice
            if !item.soldDate.isEmpty { publicItem.soldDate = item.soldDate }
        }
        if settings.showProvenance {
            if !item.purchaseDate.isEmpty { publicItem.purchaseDate = item.purchaseDate }
            if !item.source.isEmpty { publicItem.source = item.source }
        }
        if settings.showNotes, !item.notes.isEmpty { publicItem.notes = item.notes }
        return publicItem
    }

    // MARK: Slugs and links

    static let slugLength = 22
    static let slugAlphabet = Array("23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ")

    static func generateSlug(randomBytes: (Int) -> [UInt8] = { count in (0..<count).map { _ in UInt8.random(in: 0...255) } }) -> String {
        String(randomBytes(slugLength).prefix(slugLength).map { slugAlphabet[Int($0) % slugAlphabet.count] })
    }

    static func isValidSlug(_ value: String) -> Bool {
        value.count == slugLength && value.allSatisfy { slugAlphabet.contains($0) }
    }

    static func sharePath(_ slug: String) -> String { "/c/\(slug)" }

    // shareSettingsChanged: only the fields the dialog can change.
    static func settingsChanged(saved: ShareSettings, draft: ShareSettings) -> Bool {
        if saved.exploreItemIds != draft.exploreItemIds { return true }
        let trimmed = { (value: String) in value.trimmingCharacters(in: .whitespacesAndNewlines) }
        return saved.visibility != draft.visibility
            || trimmed(saved.title) != trimmed(draft.title)
            || trimmed(saved.blurb) != trimmed(draft.blurb)
            || saved.showOnExplore != draft.showOnExplore
            || flags(saved) != flags(draft)
    }

    // toggleExplorePick from src/utils/explore.js.
    static func toggleExplorePick(_ ids: [String], _ id: String, limit: Int = Mapping.exploreStripLimit) -> [String] {
        let picks = Mapping.normalizeExplorePicks(ids, limit: limit)
        if picks.contains(id) { return picks.filter { $0 != id } }
        if picks.count >= limit { return picks }
        return picks + [id]
    }

    // The edition chip on a card: "First edition · Second printing" for a book,
    // the free-text edition for anything else.
    static func editionLine(category: String, edition: String, bookEdition: String, bookPrinting: String) -> String {
        guard category == "Book" else { return edition }
        return [bookEdition.isEmpty ? nil : "\(bookEdition) edition", bookPrinting.isEmpty ? nil : "\(bookPrinting) printing"]
            .compactMap { $0 }
            .joined(separator: " · ")
    }
}
