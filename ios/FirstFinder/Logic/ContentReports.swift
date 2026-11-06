import Foundation

// Reporting a shared collection and blocking its owner, as the phone sees them:
// which page is on screen, what gets sent, and what to hide. The server decides
// everything else (src/utils/contentReports.js on the web), and these reasons
// mirror its REPORT_REASONS, which refuses any value not on its list.
enum ContentReports {
    struct Reason: Identifiable, Hashable {
        let value: String
        let label: String
        var id: String { value }
    }

    static let reasons = [
        Reason(value: "spam", label: "Spam or advertising"),
        Reason(value: "offensive", label: "Offensive or sexual content"),
        Reason(value: "harassment", label: "Harassment or hate"),
        Reason(value: "private_info", label: "Someone's private information"),
        Reason(value: "illegal", label: "Something illegal, or stolen goods"),
        Reason(value: "other", label: "Something else"),
    ]

    static let detailsMax = 1000
    static let supportEmail = "thebookbarterer@gmail.com"

    // The id is the block's own, never the owner's account, which the server
    // keeps to itself. slug is nil when the page is off, or has moved to a link
    // this person was not given.
    struct Block: Decodable, Hashable, Identifiable, Sendable {
        var id: String
        var slug: String?
        var title: String
    }

    struct BlocksResponse: Decodable {
        var blocks: [Block]
    }

    struct PageRef: Hashable, Identifiable {
        var slug: String
        var itemId: String?
        var id: String { slug + (itemId ?? "") }
    }

    private static let slugAlphabet = Set("23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ")

    static func isValidSlug(_ slug: String) -> Bool {
        slug.count == 22 && slug.allSatisfy(slugAlphabet.contains)
    }

    // Which shared page a URL is, if any. Read from the web view's address rather
    // than the route that opened it, because Explore links to these pages from
    // inside the same web view.
    static func pageRef(from url: URL?) -> PageRef? {
        guard let url else { return nil }
        let parts = url.path().split(separator: "/").map(String.init)
        guard parts.count == 2, parts[0] == "c", isValidSlug(parts[1]) else { return nil }
        let itemId = url.fragment().flatMap { $0.hasPrefix("item-") ? String($0.dropFirst(5)) : nil }
        return PageRef(slug: parts[1], itemId: itemId.flatMap { UUID(uuidString: $0) == nil ? nil : $0 })
    }

    static func reportBody(page: PageRef, reason: Reason, details: String) throws -> Data {
        var body: [String: String] = [
            "slug": page.slug,
            "reason": reason.value,
            "details": String(details.trimmingCharacters(in: .whitespacesAndNewlines).prefix(detailsMax)),
        ]
        if let itemId = page.itemId { body["itemId"] = itemId }
        return try JSONEncoder().encode(body)
    }

    static func blockBody(slug: String) throws -> Data {
        try JSONEncoder().encode(["action": "block", "slug": slug])
    }

    static func unblockBody(id: String) throws -> Data {
        try JSONEncoder().encode(["action": "unblock", "id": id])
    }

    static func decodeBlocks(_ data: Data) throws -> [Block] {
        try JSONDecoder().decode(BlocksResponse.self, from: data).blocks
    }

    static func visibleShelves(_ shelves: [FeaturedShelf], blocked: Set<String>) -> [FeaturedShelf] {
        shelves.filter { !blocked.contains($0.slug) }
    }

    // Explore is one page for everyone, rendered by the server for no one in
    // particular, so a person's blocks are applied here. Each shelf on it is a
    // section holding links to that collection. Slugs are checked first because
    // they end up inside a script.
    static func hidingScript(blocked: Set<String>) -> String? {
        let selectors = blocked.filter(isValidSlug).sorted().map {
            "section:not(:has(section)):has(a[href^=\"/c/\($0)\"])"
        }
        guard !selectors.isEmpty else { return nil }
        return """
        (function () {
          var style = document.createElement('style');
          style.textContent = '\(selectors.joined(separator: ", ")) { display: none !important; }';
          document.documentElement.appendChild(style);
        })();
        """
    }

    // For someone signed out, who has no account to report from. Only the page's
    // address goes in, and they see it before sending.
    static func emailURL(pageURL: URL?) -> URL? {
        var parts = URLComponents()
        parts.scheme = "mailto"
        parts.path = supportEmail
        parts.queryItems = [
            URLQueryItem(name: "subject", value: "Reporting a FirstFinder page"),
            URLQueryItem(name: "body", value: "Page: \(pageURL?.absoluteString ?? "")\n\nWhat's wrong with it:\n"),
        ]
        return parts.url
    }
}
