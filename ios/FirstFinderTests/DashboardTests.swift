import XCTest
@testable import FirstFinder

// Ported from src/utils/dashboard.test.js.
final class DashboardLogicTests: XCTestCase {
    private func item(_ id: String = "", purchaseDate: String = "", purchasePrice: Decimal? = nil, status: String = "Owned", soldDate: String = "", category: String = "Book", savedAt: String = "") -> Item {
        Item(id: id, category: category, status: status, purchaseDate: purchaseDate, purchasePrice: purchasePrice, soldDate: soldDate, savedAt: savedAt)
    }

    private func buckets(_ items: [Item]) -> [DashboardLogic.Bucket] {
        DashboardLogic.monthlyBuckets(items, date: \.purchaseDate, amount: \.purchasePrice)
    }

    func testMonthLabel() {
        XCTAssertEqual(DashboardLogic.monthLabel("2026-01"), "Jan 26")
        XCTAssertEqual(DashboardLogic.monthLabel("2026-12"), "Dec 26")
    }

    func testReturnsNothingWhenNoItemCarriesAUsableDate() {
        XCTAssertEqual(buckets([item(purchaseDate: "", purchasePrice: 10), item(purchaseDate: "nonsense", purchasePrice: 10)]), [])
        XCTAssertEqual(buckets([]), [])
    }

    func testCountsAndSumsTheItemsInAMonth() {
        let result = buckets([item(purchaseDate: "2026-01-05", purchasePrice: 10), item(purchaseDate: "2026-01-20", purchasePrice: 15)])
        XCTAssertEqual(result, [.init(key: "2026-01", count: 2, amount: 25)])
    }

    func testFillsInTheMonthsWhereNothingHappened() {
        let result = buckets([item(purchaseDate: "2026-01-05", purchasePrice: 10), item(purchaseDate: "2026-03-05", purchasePrice: 20)])
        XCTAssertEqual(result.map(\.key), ["2026-01", "2026-02", "2026-03"])
        XCTAssertEqual(result[1].count, 0)
        XCTAssertEqual(result[1].amount, 0)
    }

    func testSpansAYearBoundary() {
        let result = buckets([item(purchaseDate: "2025-11-05", purchasePrice: 10), item(purchaseDate: "2026-02-05", purchasePrice: 20)])
        XCTAssertEqual(result.map(\.key), ["2025-11", "2025-12", "2026-01", "2026-02"])
    }

    func testIgnoresItemsWithNoDate() {
        let result = buckets([item(purchaseDate: "2026-01-05", purchasePrice: 10), item(purchaseDate: "", purchasePrice: 999)])
        XCTAssertEqual(result.count, 1)
        XCTAssertEqual(result[0].amount, 10)
    }

    func testAMissingPriceCountsButAddsNothing() {
        let result = buckets([item(purchaseDate: "2026-01-05", purchasePrice: nil)])
        XCTAssertEqual(result, [.init(key: "2026-01", count: 1, amount: 0)])
    }

    func testDateForUsesTheSaleDateForASoldItem() {
        XCTAssertEqual(DashboardLogic.dateFor(item(purchaseDate: "2020-01-01", status: "Sold", soldDate: "2026-06-01")), "2026-06-01")
        XCTAssertEqual(DashboardLogic.dateFor(item(purchaseDate: "2020-01-01")), "2020-01-01")
    }

    // vi.setSystemTime(new Date("2026-09-07T12:00:00Z")) on the web.
    private let now = ISO8601DateFormatter().date(from: "2026-09-07T12:00:00Z")!
    private var inventory: [Item] {
        [
            item("1", purchaseDate: "2026-08-01"),
            item("2", purchaseDate: "2019-01-01"),
            item("3", purchaseDate: "2026-08-01", category: "Comic"),
            item("4", purchaseDate: ""),
        ]
    }

    func testReturnsEverythingWhenNothingIsFiltered() {
        let result = DashboardLogic.applyFilters(inventory, category: "", rangeKey: "all", now: now)
        XCTAssertEqual(result.visible.count, 4)
        XCTAssertEqual(result.undatedExcluded, 0)
    }

    func testFiltersByCategory() {
        XCTAssertEqual(DashboardLogic.applyFilters(inventory, category: "Comic", rangeKey: "all", now: now).visible.count, 1)
    }

    func testFiltersByPeriodAndCountsTheUndated() {
        let result = DashboardLogic.applyFilters(inventory, category: "", rangeKey: "12m", now: now)
        XCTAssertEqual(result.visible.count, 2)
        XCTAssertEqual(result.undatedExcluded, 1)
    }

    func testScopesYearToDateToThisCalendarYear() {
        let result = DashboardLogic.applyFilters(inventory, category: "", rangeKey: "ytd", now: now)
        XCTAssertTrue(result.visible.allSatisfy { $0.purchaseDate.hasPrefix("2026") })
    }

    func testCombinesACategoryAndAPeriod() {
        XCTAssertEqual(DashboardLogic.applyFilters(inventory, category: "Book", rangeKey: "12m", now: now).visible.count, 1)
    }

    func testRangeStart() {
        XCTAssertNil(DashboardLogic.rangeStart("all", now: now))
        XCTAssertNil(DashboardLogic.rangeStart("nonsense", now: now))
        let start = DashboardLogic.rangeStart("ytd", now: now)!
        let parts = Calendar.current.dateComponents([.year, .month, .day, .hour], from: start)
        XCTAssertEqual([parts.year, parts.month, parts.day, parts.hour], [2026, 1, 1, 0])
    }

    // JavaScript's setMonth rolls over rather than clamping: May 31 minus
    // three months is March 3 (February 31). The port must agree, or the
    // 3-month figures differ from the web's on the last days of a month.
    func testMonthsBackRollOverLikeSetMonth() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "UTC")!
        let may31 = ISO8601DateFormatter().date(from: "2026-05-31T12:00:00Z")!
        let start = DashboardLogic.rangeStart("3m", now: may31, calendar: calendar)!
        let parts = calendar.dateComponents([.month, .day], from: start)
        XCTAssertEqual([parts.month, parts.day], [3, 3])
    }

    func testHasFindDate() {
        XCTAssertTrue(DashboardLogic.hasFindDate(item(purchaseDate: "2025-12-05")))
        XCTAssertFalse(DashboardLogic.hasFindDate(item(purchaseDate: "")))
        XCTAssertFalse(DashboardLogic.hasFindDate(item(purchaseDate: "sometime in the spring")))
    }

    func testRecentFindsOrdersByWhenFoundNotWhenTyped() {
        let result = DashboardLogic.recentFinds([
            item("old-buy-typed-today", purchaseDate: "2025-12-05", savedAt: "2026-09-10T09:00:00.000Z"),
            item("bought-last-week", purchaseDate: "2026-09-03", savedAt: "2026-09-03T09:00:00.000Z"),
        ], limit: 20)
        XCTAssertEqual(result.map(\.id), ["bought-last-week", "old-buy-typed-today"])
    }

    func testRecentFindsBreaksASameDayHaulByWhichWasCataloguedLast() {
        let result = DashboardLogic.recentFinds([
            item("first-in", purchaseDate: "2026-08-22", savedAt: "2026-08-22T09:00:00.000Z"),
            item("second-in", purchaseDate: "2026-08-22", savedAt: "2026-08-22T11:00:00.000Z"),
        ], limit: 20)
        XCTAssertEqual(result.map(\.id), ["second-in", "first-in"])
    }

    func testRecentFindsLeavesOutUndatedAndSoldAgainstTheLimit() {
        let result = DashboardLogic.recentFinds([
            item("undated", purchaseDate: "", savedAt: "2026-09-09T09:00:00.000Z"),
            item("sold", purchaseDate: "2026-09-09", status: "Sold", savedAt: "2026-09-09T09:00:00.000Z"),
            item("dated-a", purchaseDate: "2026-09-08", savedAt: "2026-09-08T09:00:00.000Z"),
            item("dated-b", purchaseDate: "2026-09-07", savedAt: "2026-09-07T09:00:00.000Z"),
            item("dated-c", purchaseDate: "2026-09-06", savedAt: "2026-09-06T09:00:00.000Z"),
        ], limit: 2)
        XCTAssertEqual(result.map(\.id), ["dated-a", "dated-b"])
    }

    func testNiceScaleMax() {
        XCTAssertEqual(DashboardLogic.niceScaleMax(0, integerOnly: true), 2)
        XCTAssertEqual(DashboardLogic.niceScaleMax(7, integerOnly: true), 8)
        XCTAssertEqual(DashboardLogic.niceScaleMax(870, integerOnly: false), 1000)
        XCTAssertEqual(DashboardLogic.niceScaleMax(120, integerOnly: false), 150)
    }
}

// Ported from src/utils/items.test.js.
final class ItemsLogicTests: XCTestCase {
    private func book(_ id: String = "x", name: String = "Dune", author: String = "Frank Herbert", maker: String = "", edition: String = "First", printing: String = "First", condition: String = "", status: String = "Owned", estimate: Decimal? = nil, sold: Decimal? = nil, paid: Decimal? = nil, purchaseDate: String = "", savedAt: String = "") -> Item {
        Item(id: id, name: name, category: "Book", author: author, maker: maker, bookEdition: edition, bookPrinting: printing, status: status, condition: condition, purchaseDate: purchaseDate, purchasePrice: paid, estimatedValue: estimate, soldPrice: sold, savedAt: savedAt)
    }

    func testValueForTotals() {
        XCTAssertEqual(ItemsLogic.valueForTotals(book(status: "Sold", estimate: 100, sold: 150)), 150)
        XCTAssertEqual(ItemsLogic.valueForTotals(book(status: "Sold", estimate: 100, sold: nil)), 100)
        XCTAssertEqual(ItemsLogic.valueForTotals(book(estimate: 100)), 100)
        XCTAssertNil(ItemsLogic.valueForTotals(book(estimate: nil)))
        XCTAssertEqual(ItemsLogic.valueForTotals(book(estimate: 0)), 0)
    }

    func testGain() {
        XCTAssertEqual(ItemsLogic.gain(book(estimate: 100, paid: 40)), 60)
        XCTAssertEqual(ItemsLogic.gain(book(estimate: 10, paid: 40)), -30)
        XCTAssertNil(ItemsLogic.gain(book(estimate: nil, paid: 40)))
        XCTAssertEqual(ItemsLogic.gain(book(estimate: 100, paid: nil)), 100)
    }

    func testAnUnknownValueIsADashNeverZero() {
        XCTAssertEqual(ItemsLogic.formatEstimatedValue(book(estimate: nil)), "—")
        XCTAssertEqual(ItemsLogic.formatGain(nil), "—")
        XCTAssertEqual(ItemsLogic.formatEstimatedValue(book(estimate: 1234)), "$1,234")
    }

    func testValueRange() {
        XCTAssertEqual(ItemsLogic.valueRange(low: 100, high: 200).map { [$0.low, $0.high] }, [100, 200])
        XCTAssertEqual(ItemsLogic.valueRange(low: 200, high: 100).map { [$0.low, $0.high] }, [100, 200])
        XCTAssertEqual(ItemsLogic.valueRange(low: 0, high: 80).map { [$0.low, $0.high] }, [80, 80])
        XCTAssertEqual(ItemsLogic.valueRange(low: 80, high: nil).map { [$0.low, $0.high] }, [80, 80])
        XCTAssertNil(ItemsLogic.valueRange(low: 0, high: 0))
        XCTAssertNil(ItemsLogic.valueRange(low: nil, high: -5))
    }

    func testNormalizeForMatch() {
        XCTAssertEqual(ItemsLogic.normalizeForMatch("The Gunslinger."), "the gunslinger")
        XCTAssertEqual(ItemsLogic.normalizeForMatch(""), "")
    }

    func testDuplicates() {
        XCTAssertEqual(ItemsLogic.findPossibleDuplicates(book(name: ""), in: [book()]), [])
        XCTAssertEqual(ItemsLogic.findPossibleDuplicates(book(), in: [book(author: "Someone Else")]), [])
        XCTAssertEqual(ItemsLogic.findPossibleDuplicates(book(), in: [book(author: "", maker: "Frank Herbert")]).count, 1)
        XCTAssertEqual(ItemsLogic.findPossibleDuplicates(book(condition: "Fair"), in: [book(condition: "Fair")]).first?.matchType, .possibleDuplicate)
        XCTAssertEqual(ItemsLogic.findPossibleDuplicates(book(condition: "Near Fine/Fine"), in: [book(condition: "Fair")]).first?.matchType, .potentialUpgrade)
        XCTAssertEqual(ItemsLogic.findPossibleDuplicates(book(condition: "Poor"), in: [book(condition: "Near Fine/Fine")]).first?.matchType, .possibleDuplicate)
        XCTAssertEqual(ItemsLogic.findPossibleDuplicates(book(), in: [book(edition: "Second")]).first?.matchType, .differentCopy)
        let sorted = ItemsLogic.findPossibleDuplicates(book(condition: "Fair"), in: [book("1", edition: "Second"), book("2", condition: "Fair")])
        XCTAssertEqual(sorted.map(\.matchType), [.possibleDuplicate, .differentCopy])
    }

    func testSimilarCopyLinks() {
        let links = ItemsLogic.similarCopyLinks(book(name: "The Gunslinger", author: "Stephen King"))
        XCTAssertEqual(links?.ebay.absoluteString, "https://www.ebay.com/sch/i.html?_nkw=The%20Gunslinger%20Stephen%20King%20First%20edition%20First%20printing")
        XCTAssertNil(ItemsLogic.similarCopyLinks(Item(id: "", name: "")))
        XCTAssertEqual(ItemsLogic.withClarifyingWord("First edition", "edition"), "First edition")
    }

    func testFirstCollectible() {
        let imported = "2026-08-02T03:35:03.350Z"
        XCTAssertEqual(ItemsLogic.firstCollectible([book("b", name: "Later", savedAt: "2026-09-01T00:00:00Z"), book("a", name: "Zebra", savedAt: "2026-08-01T00:00:00Z")])?.name, "Zebra")
        let rows = [book("1", name: "The Great Hunt", savedAt: imported), book("2", name: "The Dark Tower VII", savedAt: imported), book("3", name: "A Game of Thrones", savedAt: imported)]
        XCTAssertEqual(ItemsLogic.firstCollectible(rows)?.name, "A Game of Thrones")
        XCTAssertEqual(ItemsLogic.firstCollectible(rows.reversed())?.name, "A Game of Thrones")
        XCTAssertEqual(ItemsLogic.firstCollectible([book("1", name: "book 10", savedAt: imported), book("2", name: "Book 9", savedAt: imported)])?.name, "Book 9")
        XCTAssertEqual(ItemsLogic.firstCollectible([book("1", name: "[LIMITED] The Way of Kings [SIGNED]", savedAt: imported), book("2", name: "[Paperback] [SIGNED] Dune", savedAt: imported), book("3", name: "Emma", savedAt: imported)])?.name, "[Paperback] [SIGNED] Dune")
        XCTAssertEqual(ItemsLogic.firstCollectible([book("1", name: "", savedAt: imported), book("2", name: "[SIGNED]", savedAt: imported)])?.name, "[SIGNED]")
        XCTAssertEqual(ItemsLogic.firstCollectible([book("b", savedAt: imported), book("a", savedAt: imported)])?.id, "a")
        XCTAssertEqual(ItemsLogic.firstCollectible([book("1", name: "Broken", savedAt: "not a date"), book("2", name: "Real", savedAt: imported)])?.name, "Real")
        XCTAssertNil(ItemsLogic.firstCollectible([]))
    }

    func testSortInventory() {
        let items = [
            book("a", name: "Dune", estimate: 300),
            book("b", name: "", estimate: 50),
            book("c", name: "carrie", estimate: nil),
            book("d", name: "Blood Meridian", status: "Sold", estimate: 10, sold: 900),
        ]
        let ids = { (sort: String) in ItemsLogic.sort(items, by: sort).map(\.id) }
        XCTAssertEqual(ids("added"), ["a", "b", "c", "d"])
        XCTAssertEqual(ids("name"), ["d", "c", "a", "b"])
        XCTAssertEqual(ids("valueAsc"), ["b", "a", "d", "c"])
        XCTAssertEqual(ids("valueDesc"), ["d", "a", "b", "c"])

        let dated = [book("mid", purchaseDate: "2023-06-08"), book("none"), book("new", purchaseDate: "2025-10-08"), book("old", purchaseDate: "2009-01-30")]
        XCTAssertEqual(ItemsLogic.sort(dated, by: "acquiredDesc").map(\.id), ["new", "mid", "old", "none"])
        XCTAssertEqual(ItemsLogic.sort(dated, by: "acquiredAsc").map(\.id), ["old", "mid", "new", "none"])
    }
}
