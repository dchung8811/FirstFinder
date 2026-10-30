import Foundation
import XCTest
@testable import FirstFinder

// Prints the sample collection, shaped as the web's fromDbItem shapes it, and
// every dashboard figure the Swift port computes for it under each filter.
// It writes ios/build/parity/dashboard.json; a vitest run outside the app feeds the same items through
// src/utils/dashboard.js and items.js and diffs the two. It asserts nothing
// itself; it is the export half of that cross-check.
final class WebParityExport: XCTestCase {
    static let now = ISO8601DateFormatter().date(from: "2026-09-07T12:00:00Z")!

    func testExportDashboardFigures() throws {
        let items = SampleData.inventory().map { Mapping.fromDbItem($0) }

        func text(_ value: Decimal?) -> String { Format.amountText(value) }

        let webItems: [[String: Any]] = items.map { item in
            [
                "id": item.id, "name": item.name, "category": item.category, "author": item.author, "maker": item.maker,
                "status": item.status, "purchaseDate": item.purchaseDate, "purchasePrice": text(item.purchasePrice),
                "estimatedValue": text(item.estimatedValue), "soldPrice": text(item.soldPrice), "soldDate": item.soldDate,
                "savedAt": item.savedAt,
            ]
        }

        var figures: [[String: Any]] = []
        for category in ["", "Book", "Comic", "Toy"] {
            for range in DashboardLogic.ranges {
                let (visible, undated) = DashboardLogic.applyFilters(items, category: category, rangeKey: range.key, now: Self.now)
                let sold = visible.filter { $0.status == "Sold" }
                let held = visible.filter { $0.status != "Sold" }
                let topHeld = held.reduce(nil as Item?) { best, item in
                    Format.toNumber(item.estimatedValue) > Format.toNumber(best?.estimatedValue ?? 0) ? item : best
                }
                let topSold = sold.reduce(nil as Item?) { best, item in
                    Format.toNumber(item.soldPrice) > Format.toNumber(best?.soldPrice ?? 0) ? item : best
                }
                let acquisitions = DashboardLogic.monthlyBuckets(visible, date: \.purchaseDate, amount: \.purchasePrice)
                let sales = DashboardLogic.monthlyBuckets(sold, date: \.soldDate, amount: \.soldPrice)
                figures.append([
                    "category": category,
                    "range": range.key,
                    "visible": visible.count,
                    "undatedExcluded": undated,
                    "held": held.count,
                    "sold": sold.count,
                    "categoryCount": Set(held.map(\.category).filter { !$0.isEmpty }).count,
                    "totalHeld": Format.currency(held.reduce(Decimal(0)) { $0 + (ItemsLogic.valueForTotals($1) ?? 0) }),
                    "topHeld": topHeld.map { "\($0.name) \(Format.currency($0.estimatedValue))" } ?? "—",
                    "totalSold": Format.currency(sold.reduce(Decimal(0)) { $0 + Format.toNumber($1.soldPrice) }),
                    "topSold": topSold.map { "\($0.name) \(Format.currency($0.soldPrice))" } ?? "—",
                    "acquisitions": acquisitions.map { "\($0.key):\($0.count):\(Format.amountText($0.amount))" },
                    "sales": sales.map { "\($0.key):\($0.count):\(Format.amountText($0.amount))" },
                    "recent": DashboardLogic.recentFinds(visible, limit: RecentFinds.limit).map(\.id),
                ])
            }
        }

        let payload: [String: Any] = ["now": "2026-09-07T12:00:00Z", "items": webItems, "figures": figures]
        let data = try JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys])
        // ios/build is gitignored; the simulator can write to it directly.
        let out = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent()
            .appending(path: "build/parity/dashboard.json")
        try FileManager.default.createDirectory(at: out.deletingLastPathComponent(), withIntermediateDirectories: true)
        try data.write(to: out)
    }
}
