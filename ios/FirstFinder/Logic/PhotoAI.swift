import Foundation

// The two AI features -- research a photo (/api/v1/identify-book) and scan a
// cover and copyright page (/api/v1/scan-book) -- as the phone sees them: the
// results, the failures, and how the server's JSON becomes both. Pure, so the
// decoding is tested against the routes' own response shapes.
//
// The server owns everything that costs money or could be gamed: the daily
// cap, the cooldown, the model, and every error message. The phone sends
// photos and shows what comes back, word for word.
enum PhotoAI {
    struct Failure: Error, Equatable {
        let message: String
    }

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

    // What /api/v1/identify-budget says is left today. nil limit means no cap.
    struct Allowance: Equatable {
        var used: Int
        var dailyLimit: Int?
        var remaining: Int?
    }

    static func capMessage(_ limit: Int) -> String {
        "You've used your \(limit) photo identification\(limit == 1 ? "" : "s") for today. The count resets at midnight UTC."
    }

    // The limits the routes enforce, checked here first so an oversized batch
    // fails on the phone instead of after a slow upload.
    static let maxIdentifyPhotos = 4
    static let maxScanPhotos = 3

    // compressImage(file, 1400, 0.8) on the web's identify path: smaller than
    // a stored photo, because these are read once and thrown away.
    static let maxDimension: CGFloat = 1400
    static let quality: CGFloat = 0.8

    static func dataURL(_ jpeg: Data) -> String {
        "data:image/jpeg;base64," + jpeg.base64EncodedString()
    }

    static func requestBody(_ jpegs: [Data]) -> Data {
        (try? JSONEncoder().encode(["images": jpegs.map(dataURL)])) ?? Data()
    }

    // MARK: Decoding

    private struct IdentifyEnvelope: Decodable {
        struct Result: Decodable {
            struct Comp: Decodable {
                var source: String?
                var url: String?
                var price: Double?
                var saleType: String?
                var date: String?
                var editionMatch: String?
            }
            struct Cite: Decodable {
                var url: String?
                var title: String?
            }
            var title: String?
            var author: String?
            var category: String?
            var genre: String?
            var edition: String?
            var printing: String?
            var editionRationale: String?
            var condition: String?
            var estimatedValueLow: Double?
            var estimatedValueHigh: Double?
            var firstEditionFirstPrintingValueLow: Double?
            var firstEditionFirstPrintingValueHigh: Double?
            var summary: String?
            var conditionNotes: String?
            var confidence: String?
            var comparables: [Lenient<Comp>]?
            var citations: [Lenient<Cite>]?
        }
        var result: Result
        var remaining: Int?
        var dailyLimit: Int?
    }

    // A comparable or citation without a usable link is dropped: the point of
    // listing them is that the collector can open each one and check.
    static func decodeIdentify(_ data: Data) throws -> (result: IdentifyResult, allowance: Allowance?) {
        guard let envelope = try? JSONDecoder().decode(IdentifyEnvelope.self, from: data) else {
            throw Failure(message: "Couldn't read the identification result. Please try again.")
        }
        let raw = envelope.result
        let result = IdentifyResult(
            title: raw.title ?? "",
            author: raw.author ?? "",
            category: raw.category ?? "",
            genre: raw.genre ?? "",
            edition: raw.edition ?? "",
            printing: raw.printing ?? "",
            condition: raw.condition ?? "",
            summary: raw.summary ?? "",
            conditionNotes: raw.conditionNotes ?? "",
            editionRationale: raw.editionRationale ?? "",
            estimatedValueLow: raw.estimatedValueLow,
            estimatedValueHigh: raw.estimatedValueHigh,
            firstEditionLow: raw.firstEditionFirstPrintingValueLow,
            firstEditionHigh: raw.firstEditionFirstPrintingValueHigh,
            comparables: (raw.comparables ?? []).compactMap(\.value).compactMap { comp in
                guard let url = webURL(comp.url) else { return nil }
                return Comparable(
                    source: comp.source ?? url.host() ?? "", url: url, price: comp.price ?? 0,
                    date: comp.date ?? "", saleType: comp.saleType ?? "unknown", editionMatch: comp.editionMatch ?? ""
                )
            },
            citations: (raw.citations ?? []).compactMap(\.value).compactMap { cite in
                guard let url = webURL(cite.url) else { return nil }
                return Citation(title: cite.title.flatMap { $0.isEmpty ? nil : $0 } ?? url.absoluteString, url: url)
            },
            confidence: raw.confidence ?? "low"
        )
        let allowance = envelope.dailyLimit.map { Allowance(used: max(0, $0 - (envelope.remaining ?? 0)), dailyLimit: $0, remaining: envelope.remaining) }
        return (result, allowance)
    }

    private struct ScanEnvelope: Decodable {
        struct Result: Decodable {
            var category: String?
            var title: String?
            var author: String?
            var publisher: String?
            var publicationYear: String?
            var editionStatement: String?
            var printingStatement: String?
            var numberLine: String?
            var isbn: String?
        }
        var result: Result
    }

    static func decodeScan(_ data: Data) throws -> ScanFill.ScanResult {
        guard let raw = try? JSONDecoder().decode(ScanEnvelope.self, from: data).result else {
            throw Failure(message: "Couldn't read the scan result. Please try again.")
        }
        return ScanFill.ScanResult(
            category: raw.category ?? "", title: raw.title ?? "", author: raw.author ?? "",
            publisher: raw.publisher ?? "", editionStatement: raw.editionStatement ?? "",
            printingStatement: raw.printingStatement ?? "", numberLine: raw.numberLine ?? "",
            publicationYear: raw.publicationYear ?? "", isbn: raw.isbn ?? ""
        )
    }

    private struct BudgetEnvelope: Decodable {
        struct Counter: Decodable {
            var used: Int?
            var dailyLimit: Int?
            var remaining: Int?
        }
        var identify: Counter
    }

    static func decodeAllowance(_ data: Data) -> Allowance? {
        guard let counter = try? JSONDecoder().decode(BudgetEnvelope.self, from: data).identify else { return nil }
        return Allowance(used: counter.used ?? 0, dailyLimit: counter.dailyLimit, remaining: counter.remaining)
    }

    // Only http(s) links open, so a model's malformed or odd-scheme URL never
    // reaches a Link.
    private static func webURL(_ text: String?) -> URL? {
        guard let text, let url = URL(string: text.trimmingCharacters(in: .whitespaces)),
              let scheme = url.scheme?.lowercased(), scheme == "https" || scheme == "http", url.host() != nil
        else { return nil }
        return url
    }
}
