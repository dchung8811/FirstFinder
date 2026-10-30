import Foundation

// Port of src/utils/items.js: the per-item rules every screen agrees on --
// what an item is worth for the totals, how the collection sorts, and what
// counts as a possible duplicate.
enum ItemsLogic {
    static func usesAuthorField(_ category: String) -> Bool {
        Vocab.authoredCategories.contains(category)
    }

    // itemCredit: the author is shown only for categories that offer it.
    static func credit(_ item: Item) -> String {
        ExploreLogic.credit(category: item.category, author: item.author, maker: item.maker)
    }

    static func hasEstimate(_ item: Item) -> Bool {
        item.estimatedValue != nil
    }

    // What an item sold for beats its pre-sale estimate. nil when there is
    // nothing to show yet, so callers render "—" instead of a misleading $0.
    static func valueForTotals(_ item: Item) -> Decimal? {
        if item.status == "Sold", let sold = item.soldPrice { return sold }
        return item.estimatedValue
    }

    static func gain(_ item: Item) -> Decimal? {
        guard let value = valueForTotals(item) else { return nil }
        return value - Format.toNumber(item.purchasePrice)
    }

    static func formatEstimatedValue(_ item: Item) -> String {
        valueForTotals(item).map { Format.currency($0) } ?? "—"
    }

    static func formatGain(_ gain: Decimal?) -> String {
        gain.map { Format.currency($0) } ?? "—"
    }

    // MARK: Sorting

    struct SortOption: Hashable, Identifiable {
        var value: String
        var label: String
        var id: String { value }
    }

    static let sortOptions = [
        SortOption(value: "added", label: "Recently added"),
        SortOption(value: "name", label: "Title A–Z"),
        SortOption(value: "valueAsc", label: "Value: low to high"),
        SortOption(value: "valueDesc", label: "Value: high to low"),
        SortOption(value: "acquiredDesc", label: "Acquired: newest first"),
        SortOption(value: "acquiredAsc", label: "Acquired: oldest first"),
    ]

    // Items with nothing to sort on go last in every direction: an unappraised
    // book is unknown, not worth $0. The sort is stable, as Array.sort is.
    static func sort(_ items: [Item], by sort: String) -> [Item] {
        let indexed = Array(items.enumerated())
        func stable(_ less: (Item, Item) -> Bool?) -> [Item] {
            indexed.sorted { a, b in less(a.element, b.element) ?? (a.offset < b.offset) }.map(\.element)
        }
        switch sort {
        case "name":
            return stable { a, b in
                let left = a.name.trimmingCharacters(in: .whitespacesAndNewlines)
                let right = b.name.trimmingCharacters(in: .whitespacesAndNewlines)
                if left.isEmpty || right.isEmpty { return left.isEmpty == right.isEmpty ? nil : !left.isEmpty }
                let order = left.compare(right, options: [.caseInsensitive, .diacriticInsensitive, .numeric], locale: Locale(identifier: "en"))
                return order == .orderedSame ? nil : order == .orderedAscending
            }
        case "valueAsc", "valueDesc":
            let ascending = sort == "valueAsc"
            return stable { a, b in
                let left = valueForTotals(a)
                let right = valueForTotals(b)
                guard let left, let right else { return (left == nil) == (right == nil) ? nil : left != nil }
                return left == right ? nil : (ascending ? left < right : left > right)
            }
        case "acquiredAsc", "acquiredDesc":
            let ascending = sort == "acquiredAsc"
            return stable { a, b in
                let left = a.purchaseDate.trimmingCharacters(in: .whitespaces)
                let right = b.purchaseDate.trimmingCharacters(in: .whitespaces)
                if left.isEmpty || right.isEmpty { return left.isEmpty == right.isEmpty ? nil : !left.isEmpty }
                return left == right ? nil : (ascending ? left < right : left > right)
            }
        default:
            return items
        }
    }

    // MARK: Duplicates

    static func normalizeForMatch(_ value: String) -> String {
        value.lowercased()
            .replacingOccurrences(of: "[^a-z0-9]+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
    }

    static func editionMatchKey(_ item: Item) -> String {
        item.category == "Book"
            ? normalizeForMatch("\(item.bookEdition) \(item.bookPrinting)")
            : normalizeForMatch(item.edition)
    }

    static func creditMatchKey(_ item: Item) -> String {
        normalizeForMatch("\(item.author) \(item.maker)")
    }

    enum MatchType: String, Comparable {
        case possibleDuplicate = "possible_duplicate"
        case potentialUpgrade = "potential_upgrade"
        case differentCopy = "different_copy"

        var rank: Int {
            switch self {
            case .possibleDuplicate: 0
            case .potentialUpgrade: 1
            case .differentCopy: 2
            }
        }

        static func < (lhs: MatchType, rhs: MatchType) -> Bool { lhs.rank < rhs.rank }
    }

    struct DuplicateMatch: Hashable, Identifiable {
        var entry: Item
        var matchType: MatchType
        var id: String { entry.id }
    }

    // Loose on purpose (no ISBN yet): same normalized name and credit. Never
    // blocks a save -- collectors keep multiple copies, upgrades and variants.
    static func findPossibleDuplicates(_ candidate: Item, in inventory: [Item]) -> [DuplicateMatch] {
        let name = normalizeForMatch(candidate.name)
        guard !name.isEmpty else { return [] }
        let credit = creditMatchKey(candidate)
        let candidateKey = editionMatchKey(candidate)
        let candidateRank = Vocab.conditionOptions.firstIndex(of: candidate.condition)

        let matches = inventory
            .filter { normalizeForMatch($0.name) == name && creditMatchKey($0) == credit }
            .map { entry -> DuplicateMatch in
                let key = editionMatchKey(entry)
                let sameEdition = !candidateKey.isEmpty && candidateKey == key
                let entryRank = Vocab.conditionOptions.firstIndex(of: entry.condition)
                let isUpgrade = sameEdition && candidateRank != nil && entryRank != nil && candidateRank! < entryRank!
                var type = MatchType.possibleDuplicate
                if isUpgrade { type = .potentialUpgrade }
                else if !candidateKey.isEmpty, !key.isEmpty, !sameEdition { type = .differentCopy }
                return DuplicateMatch(entry: entry, matchType: type)
            }
        return Array(matches.enumerated()).sorted { a, b in
            a.element.matchType == b.element.matchType ? a.offset < b.offset : a.element.matchType < b.element.matchType
        }.map(\.element)
    }

    // MARK: Similar copies

    static func withClarifyingWord(_ value: String, _ word: String) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return trimmed }
        return trimmed.lowercased().contains(word.lowercased()) ? trimmed : "\(trimmed) \(word)"
    }

    static func similarCopyLinks(_ item: Item) -> (abebooks: URL, ebay: URL)? {
        var parts = [item.name, item.author, item.maker]
        if item.category == "Book" {
            if !item.bookEdition.isEmpty { parts.append(withClarifyingWord(item.bookEdition, "edition")) }
            if !item.bookPrinting.isEmpty { parts.append(withClarifyingWord(item.bookPrinting, "printing")) }
        } else if !item.edition.isEmpty {
            parts.append(item.edition)
        }
        let query = parts.filter { !$0.isEmpty }.joined(separator: " ").trimmingCharacters(in: .whitespaces)
        guard !query.isEmpty else { return nil }
        let encoded = encodeURIComponent(query)
        guard let abe = URL(string: "https://www.abebooks.com/servlet/SearchResults?kn=\(encoded)"),
              let ebay = URL(string: "https://www.ebay.com/sch/i.html?_nkw=\(encoded)")
        else { return nil }
        return (abe, ebay)
    }

    static func encodeURIComponent(_ value: String) -> String {
        var allowed = CharacterSet.alphanumerics
        allowed.formUnion(CharacterSet(charactersIn: "-_.!~*'()"))
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }

    // MARK: First collectible

    // firstCollectible: earliest catalogued, ties broken by name (leading
    // [tags] ignored, untitled last), then id, so a CSV import's shared
    // timestamp gives the same answer every time.
    static func firstCollectible(_ inventory: [Item]) -> Item? {
        let iso = ISO8601DateFormatter()
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        func time(_ item: Item) -> Double {
            (iso.date(from: item.savedAt) ?? fractional.date(from: item.savedAt))?.timeIntervalSince1970 ?? .infinity
        }
        func sortable(_ name: String) -> String {
            let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
            let stripped = trimmed.replacingOccurrences(of: #"^(\[[^\]]*\]\s*)+"#, with: "", options: .regularExpression)
                .trimmingCharacters(in: .whitespacesAndNewlines)
            return stripped.isEmpty ? trimmed : stripped
        }
        return inventory.min { a, b in
            let (ta, tb) = (time(a), time(b))
            if ta != tb { return ta < tb }
            let (na, nb) = (sortable(a.name), sortable(b.name))
            if !na.isEmpty, nb.isEmpty { return true }
            if na.isEmpty, !nb.isEmpty { return false }
            let order = na.compare(nb, options: [.caseInsensitive, .diacriticInsensitive, .numeric], locale: Locale(identifier: "en"))
            if order != .orderedSame { return order == .orderedAscending }
            return a.id < b.id
        }
    }

    // MARK: AI value ranges

    // toValueRange: a model can return low > high or one side missing; clamp
    // rather than show a nonsensical range. nil when both are ≤ 0.
    static func valueRange(low rawLow: Double?, high rawHigh: Double?) -> (low: Double, high: Double)? {
        let low = rawLow ?? 0
        let high = rawHigh ?? 0
        if low <= 0 && high <= 0 { return nil }
        if low <= 0 { return (high, high) }
        if high <= 0 { return (low, low) }
        return low <= high ? (low, high) : (high, low)
    }
}
