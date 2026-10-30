import Foundation

// Port of src/utils/bookSearch.js: the book-name field's suggestions, from
// the hand-written guides first, then the catalog (search_book_catalog).
enum BookSearch {
    static let minQueryLength = 3
    static let maxSuggestions = 8

    struct Suggestion: Hashable, Identifiable {
        enum Tier { case guide, catalog }
        var key: String
        var tier: Tier
        var title: String
        var author: String
        var publisher: String
        var year: Int?
        var guidePath: String?
        var id: String { key }
    }

    struct Work: Decodable, Hashable {
        var slug: String
        var title: String
        var author: String
        var publisher: String
        var year: Int?
        var guidePath: String
    }

    // The guides, bundled from src/content/books (see
    // ios/scripts/book-guides-parity.test.js).
    static let works: [Work] = {
        struct File: Decodable { var works: [Work] }
        guard let url = Bundle.main.url(forResource: "BookGuides", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let file = try? JSONDecoder().decode(File.self, from: data)
        else { return [] }
        return file.works
    }()

    static func normalize(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    static func comparableTitle(_ value: String) -> String {
        value
            .replacingOccurrences(of: #"\[[^\]]*\]"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: #"\([^)]*\)?.*$"#, with: "", options: .regularExpression)
            .lowercased()
            .replacingOccurrences(of: #"^(the|a|an)\s+"#, with: "", options: .regularExpression)
            .replacingOccurrences(of: "[^a-z0-9]+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespaces)
    }

    static func isSearchable(_ query: String) -> Bool {
        query.trimmingCharacters(in: .whitespacesAndNewlines).count >= minQueryLength
    }

    static func searchGuides(_ query: String, works: [Work] = works) -> [Suggestion] {
        guard isSearchable(query) else { return [] }
        let needle = normalize(query)
        func rank(_ work: Work) -> Int {
            let title = normalize(work.title)
            if title == needle { return 0 }
            if title.hasPrefix(needle) { return 1 }
            if normalize(work.author).hasPrefix(needle) { return 2 }
            return 3
        }
        return works
            .filter { "\(normalize($0.title)) \(normalize($0.author))".contains(needle) }
            .sorted { rank($0) == rank($1) ? $0.title.localizedCompare($1.title) == .orderedAscending : rank($0) < rank($1) }
            .map { Suggestion(key: "work:\($0.slug)", tier: .guide, title: $0.title, author: $0.author, publisher: $0.publisher, year: $0.year, guidePath: $0.guidePath) }
    }

    static func merge(guides: [Suggestion], catalog: [BookCatalogRow], limit: Int = maxSuggestions) -> [Suggestion] {
        let fromCatalog = catalog.map {
            Suggestion(key: "catalog:\($0.id)", tier: .catalog, title: $0.title, author: $0.author ?? "", publisher: $0.publisher ?? "", year: $0.firstPublishedYear, guidePath: nil)
        }
        var merged: [Suggestion] = []
        var seen = Set<String>()
        for suggestion in guides + fromCatalog where !suggestion.title.isEmpty {
            let identity = "\(comparableTitle(suggestion.title))|\(normalize(suggestion.author))"
            if seen.contains(identity) { continue }
            seen.formUnion([identity])
            merged.append(suggestion)
            if merged.count >= limit { break }
        }
        return merged
    }

    static func subtitle(_ suggestion: Suggestion) -> String {
        [suggestion.author, suggestion.publisher, suggestion.year.map(String.init) ?? ""].filter { !$0.isEmpty }.joined(separator: " · ")
    }

    // applyBookSuggestion: a picked book fills title, credit and publisher,
    // and assumes a first edition, first printing unless already set.
    static func apply(_ suggestion: Suggestion, to item: Item) -> Item {
        var next = item
        next.name = suggestion.title
        next.category = "Book"
        if !suggestion.author.isEmpty { next.author = suggestion.author }
        if !suggestion.publisher.isEmpty { next.maker = suggestion.publisher }
        if next.bookEdition.isEmpty { next.bookEdition = "First" }
        if next.bookPrinting.isEmpty { next.bookPrinting = "First" }
        return next
    }
}
