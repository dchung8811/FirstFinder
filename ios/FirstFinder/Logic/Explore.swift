import Foundation

// The home page's featured shelves, as GET /api/featured-shelves returns them.
// The site builds this on its server from shelves whose owners listed their
// page and switched Explore on; the phone only reads the result.
struct FeaturedShelf: Decodable, Hashable, Sendable, Identifiable {
    struct Cover: Decodable, Hashable, Sendable {
        var id: String
        var name: String?
        var author: String?
        var maker: String?
        var category: String?
        // Signed by the site for an hour. Used as handed over, never stored.
        var photoUrl: String?
    }

    var slug: String
    var title: String
    var blurb: String?
    var itemCount: Int
    var covers: [Cover]

    var id: String { slug }
}

struct FeaturedShelvesResponse: Decodable, Sendable {
    var shelves: [FeaturedShelf]
}

// One cover on the moving strip, carrying the shelf it came from, which is
// where tapping it goes.
struct ShelfStripCover: Hashable, Sendable, Identifiable {
    var cover: FeaturedShelf.Cover
    var shelfSlug: String
    var shelfTitle: String

    var id: String { cover.id }
}

// Ports of the cover helpers in src/utils/explore.js, items.js and
// publicCollection.js that the home page uses.
enum ExploreLogic {
    // interleaveShelfCovers: covers dealt from each shelf in turn -- first of
    // each, then second of each -- so the strip shows several collections side
    // by side instead of one shelf and then the next.
    static func interleave(_ shelves: [FeaturedShelf]) -> [ShelfStripCover] {
        let longest = shelves.map(\.covers.count).max() ?? 0
        var dealt: [ShelfStripCover] = []
        for index in 0..<longest {
            for shelf in shelves where index < shelf.covers.count {
                dealt.append(ShelfStripCover(cover: shelf.covers[index], shelfSlug: shelf.slug, shelfTitle: shelf.title))
            }
        }
        return dealt
    }

    // collectionMonogram: the two-letter mark beside each shelf's title.
    static func monogram(_ title: String) -> String {
        var trimmed = title
        if let range = trimmed.range(of: "'s collection", options: [.caseInsensitive, .anchored, .backwards]) {
            trimmed.removeSubrange(range)
        }
        let words = trimmed
            .split(whereSeparator: \.isWhitespace)
            .map { word in String(word.unicodeScalars.filter { CharacterSet.letters.contains($0) || CharacterSet.decimalDigits.contains($0) }.map(Character.init)) }
            .filter { !$0.isEmpty }
        guard let first = words.first else { return "FF" }
        if words.count == 1 { return String(first.prefix(2)).uppercased() }
        return (String(first.prefix(1)) + String(words[1].prefix(1))).uppercased()
    }

    // jacketTone: which of four palette colors an unphotographed book's jacket
    // gets, by item id, so it matches /explore and doesn't reshuffle. Hashes
    // UTF-16 code units with 32-bit wraparound, as charCodeAt and >>> 0 do.
    static let jacketTones: [UInt32] = [0x123f38, 0x3f352a, 0x6d5526, 0x8f3524]

    static func jacketToneIndex(_ id: String) -> Int {
        var hash: UInt32 = 0
        for unit in id.utf16 { hash = hash &* 31 &+ UInt32(unit) }
        return Int(hash % UInt32(jacketTones.count))
    }

    // itemCredit: the author is shown only for categories that offer it.
    static func credit(category: String?, author: String?, maker: String?) -> String {
        let usesAuthor = Vocab.authoredCategories.contains(category ?? "")
        let parts = usesAuthor ? [author, maker] : [maker]
        return parts.map { ($0 ?? "").trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }.joined(separator: " · ")
    }

    // publicItemHref: the cover opens this book on its shelf.
    static func publicItemPath(slug: String, itemId: String) -> String {
        "/c/\(slug)#item-\(itemId)"
    }
}
