import Foundation
import Observation

// The AI features, faked. On the web, identify and scan-to-fill send photos
// to paid model calls and spend the account's two daily identifications; the
// prototype never makes either request. It waits 1.5 seconds and answers with
// a canned result -- or, as chosen under More → Developer, with each of the
// failures the real routes return, word for word.
@MainActor
@Observable
final class FakeAI {
    enum Outcome: String, CaseIterable, Identifiable {
        case success = "Success"
        case notABook = "Not a book"
        case cooldown = "Going too fast"
        case dailyCap = "Daily cap reached"
        case incomplete = "Didn't finish"
        case outOfCredit = "Out of budget"
        case busy = "Service busy"

        var id: String { rawValue }
    }

    struct Failure: Error, Equatable {
        let message: String
    }

    var outcome: Outcome = .success

    // The real cap, counted on the phone: two a day, resetting at midnight
    // UTC, and a three-second cooldown between calls.
    static let dailyLimit = 2
    static let cooldown: TimeInterval = 3
    private(set) var usedToday = 0
    private var usageDay = ""
    private var lastCall: Date?

    let delay: Duration = .milliseconds(1500)

    var remainingToday: Int {
        rollDay()
        return max(0, Self.dailyLimit - usedToday)
    }

    func resetUsage() {
        usedToday = 0
        lastCall = nil
    }

    private func rollDay(now: Date = Date()) {
        let today = Format.todayIso(now: now)
        if today != usageDay {
            usageDay = today
            usedToday = 0
        }
    }

    static func capMessage(_ limit: Int) -> String {
        "You've used your \(limit) photo identification\(limit == 1 ? "" : "s") for today. The count resets at midnight UTC."
    }

    // MARK: Identify

    struct Comparable: Hashable, Identifiable {
        var source: String
        var url: URL
        var price: Double
        var date: String
        var saleType: String
        var editionMatch: String
        var id: String { url.absoluteString + date }
    }

    struct Citation: Hashable, Identifiable {
        var title: String
        var url: URL
        var id: String { url.absoluteString }
    }

    struct IdentifyResult: Hashable {
        var title: String
        var author: String
        var category: String
        var genre: String
        var edition: String
        var printing: String
        var condition: String
        var summary: String
        var conditionNotes: String
        var editionRationale: String
        var estimatedValueLow: Double?
        var estimatedValueHigh: Double?
        var firstEditionLow: Double?
        var firstEditionHigh: Double?
        var comparables: [Comparable]
        var citations: [Citation]
        var confidence: String
    }

    func identify(photoCount: Int) async throws -> IdentifyResult {
        try checkCooldownAndCap()
        try await Task.sleep(for: delay)
        switch outcome {
        case .success: break
        case .notABook: throw Failure(message: "That doesn't look like a book or printed collectible. Try a photo of the cover.")
        case .cooldown: throw Failure(message: "You're going a little fast — give it a few seconds and try again.")
        case .dailyCap: throw Failure(message: Self.capMessage(Self.dailyLimit))
        case .incomplete: throw Failure(message: "Couldn't finish researching that item in time. Try again, or with fewer photos.")
        case .outOfCredit: throw Failure(message: "Photo identification has used up its budget for now. It'll work again once the account is topped up.")
        case .busy: throw Failure(message: "The identification service is busy right now. Try again in a moment.")
        }
        usedToday += 1
        return Self.sampleIdentification(photoCount: photoCount)
    }

    private func checkCooldownAndCap() throws {
        rollDay()
        if let lastCall, Date().timeIntervalSince(lastCall) < Self.cooldown {
            throw Failure(message: "You're going a little fast — give it a few seconds and try again.")
        }
        lastCall = Date()
        if usedToday >= Self.dailyLimit, outcome == .success {
            throw Failure(message: Self.capMessage(Self.dailyLimit))
        }
    }

    // Invented, and labelled as samples wherever they show: the sources are
    // example.com addresses, not real listings.
    static func sampleIdentification(photoCount: Int) -> IdentifyResult {
        let base = URL(string: "https://example.com")!
        return IdentifyResult(
            title: "The Lantern Keeper's Almanac",
            author: "Mara Ellery",
            category: "Book",
            genre: "Fantasy",
            edition: photoCount > 1 ? "First" : "",
            printing: photoCount > 1 ? "First" : "",
            condition: "Very Good/Good",
            summary: "A sample identification: a 1987 fantasy novel from Hollow Oak Press, in its original jacket. Nothing here was looked up — the prototype answers every photo with this book.",
            conditionNotes: "Light shelf wear on the jacket spine. A clean, unclipped jacket is most of the value on this title.",
            editionRationale: photoCount > 1
                ? "The copyright page states \"First Edition\" and the number line runs down to 1."
                : "A cover alone can't show the edition. Add the copyright page and re-check.",
            estimatedValueLow: 180,
            estimatedValueHigh: 320,
            firstEditionLow: 450,
            firstEditionHigh: 800,
            comparables: [
                Comparable(source: "Sample auction house", url: base.appending(path: "sample/auction"), price: 410, date: "2026-03-14", saleType: "auction_result", editionMatch: "First edition, first printing, jacket price-clipped."),
                Comparable(source: "Sample bookseller", url: base.appending(path: "sample/sold"), price: 260, date: "2026-01-22", saleType: "sold", editionMatch: "Edition unstated; later printing likely."),
                Comparable(source: "Sample marketplace", url: base.appending(path: "sample/listing"), price: 599, date: "", saleType: "active_listing", editionMatch: "Asking price for a signed copy."),
            ],
            citations: [
                Citation(title: "Sample price guide", url: base.appending(path: "sample/guide")),
                Citation(title: "Sample collector forum thread", url: base.appending(path: "sample/forum")),
            ],
            confidence: photoCount > 1 ? "medium" : "low"
        )
    }

    // MARK: Scan

    func scan(photoCount: Int) async throws -> ScanFill.ScanResult {
        try await Task.sleep(for: delay)
        switch outcome {
        case .notABook: throw Failure(message: "That doesn't look like a book or printed collectible. Try the cover or the copyright page.")
        case .incomplete, .busy, .outOfCredit: throw Failure(message: "Couldn't finish reading those photos. Please try again.")
        default: break
        }
        // One photo reads only the cover; two or more include the copyright page.
        return ScanFill.ScanResult(
            category: "Book",
            title: "The Lantern Keeper's Almanac",
            author: "Mara Ellery",
            publisher: photoCount > 1 ? "Hollow Oak Press" : "",
            editionStatement: photoCount > 1 ? "First Edition" : "",
            printingStatement: "",
            numberLine: photoCount > 1 ? "10 9 8 7 6 5 4 3 2 1" : "",
            publicationYear: photoCount > 1 ? "1987" : "",
            isbn: photoCount > 1 ? "0-000-00000-0" : ""
        )
    }
}
