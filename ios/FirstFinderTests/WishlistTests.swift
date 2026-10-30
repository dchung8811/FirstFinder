import XCTest
@testable import FirstFinder

// Ported from src/utils/wishlist.test.js.
final class WishlistLogicTests: XCTestCase {
    func testNeedsANameAndNothingElse() {
        XCTAssertFalse(WishlistLogic.isSaveable(Want(id: "", name: "  ")))
        XCTAssertTrue(WishlistLogic.isSaveable(Want(id: "", name: "Dune")))
    }

    func testConditionFloor() {
        XCTAssertTrue(WishlistLogic.meetsConditionFloor("Very Good/Good", "Very Good/Good"))
        XCTAssertTrue(WishlistLogic.meetsConditionFloor("Near Fine/Fine", "Very Good/Good"))
        XCTAssertFalse(WishlistLogic.meetsConditionFloor("Fair", "Very Good/Good"))
        XCTAssertTrue(WishlistLogic.meetsConditionFloor("Fair", ""))
        XCTAssertTrue(WishlistLogic.meetsConditionFloor("", "Very Good/Good"), "an ungraded copy isn't a failure")
    }

    func testPhrasesTheSpecTheWayACollectorWouldSayIt() {
        let want = Want(id: "", wantedEdition: "First", wantedPrinting: "First", publisher: "Chilton, 1965", minCondition: "Very Good/Good", jacketRequirement: "required", signatureRequirement: "signed")
        XCTAssertEqual(WishlistLogic.describeCriteria(want).map(\.text), ["First edition · First printing", "Chilton, 1965", "Jacket required", "Very Good/Good or better", "Signed"])
        XCTAssertEqual(WishlistLogic.describeCriteria(Want(id: "", wantedEdition: "First edition")).map(\.text), ["First edition"])
        XCTAssertEqual(WishlistLogic.describeCriteria(Want(id: "")), [])
        XCTAssertEqual(WishlistLogic.describeCriteria(Want(id: "", wantedPrinting: "Second")).map(\.text), ["Second printing"])
    }

    func testGrailsFirstAndNewestFirstWithinAPriority() {
        let wants = [
            Want(id: "a", priority: "someday", createdAt: "2026-03-01"),
            Want(id: "b", priority: "grail", createdAt: "2026-01-01"),
            Want(id: "c", priority: "hunting", createdAt: "2026-02-01"),
            Want(id: "d", priority: "hunting", createdAt: "2026-04-01"),
            Want(id: "e", priority: "", createdAt: "2026-01-15"),
        ]
        XCTAssertEqual(WishlistLogic.sort(wants).map(\.id), ["b", "d", "c", "e", "a"])
    }

    func testCountsAndTotalsOnlyWhatIsStillBeingHunted() {
        let summary = WishlistLogic.summarize([
            Want(id: "a", maxPrice: 100, priority: "grail"),
            Want(id: "b", maxPrice: nil, upgradeForItemId: "x"),
            Want(id: "c", maxPrice: 900, foundAt: "2026-01-01"),
        ])
        XCTAssertEqual(summary, .init(openCount: 2, foundCount: 1, ceilingTotal: 100, withCeiling: 1, grailCount: 1, upgradeCount: 1))
        XCTAssertEqual(WishlistLogic.summarize([]), .init())
    }

    func testSearchesForTheCopyWanted() {
        let links = WishlistLogic.searchLinks(Want(id: "", name: "Dune", maker: "Frank Herbert", wantedEdition: "First", signatureRequirement: "signed"))
        XCTAssertEqual(links?.ebay.absoluteString, "https://www.ebay.com/sch/i.html?_nkw=Dune%20Frank%20Herbert%20First%20edition%20signed")
        XCTAssertNil(WishlistLogic.searchLinks(Want(id: "")))
    }

    func testAFoundWantBecomesAnItem() {
        let want = Want(id: "", name: "Dune", maker: "Frank Herbert", category: "Book", wantedEdition: "First", wantedPrinting: "First", minCondition: "Fair", preferredSource: "Book fair", notes: "From the list")
        let item = WishlistLogic.toItem(want, found: .init(condition: "", purchasePrice: "250", source: "", purchaseDate: "2026-09-01"))
        XCTAssertEqual(item.author, "Frank Herbert")
        XCTAssertEqual(item.bookEdition, "First")
        XCTAssertEqual(item.condition, "", "never guesses the condition from the floor")
        XCTAssertEqual(item.source, "Book fair", "falls back to the preferred seller")
        XCTAssertEqual(item.purchasePrice, 250)
        XCTAssertNil(item.estimatedValue)

        let record = WishlistLogic.toItem(Want(id: "", name: "LP", maker: "Band", category: "Record", wantedEdition: "First"))
        XCTAssertEqual([record.author, record.maker, record.bookEdition], ["", "Band", ""])
    }

    func testComparesToTheCeiling() {
        let want = Want(id: "", maxPrice: 200)
        XCTAssertEqual(WishlistLogic.compareToCeiling(want, paid: "150"), .init(ceiling: 200, paid: 150, difference: 50, under: true))
        XCTAssertEqual(WishlistLogic.compareToCeiling(want, paid: "250")?.under, false)
        XCTAssertEqual(WishlistLogic.compareToCeiling(want, paid: "200")?.under, true)
        XCTAssertNil(WishlistLogic.compareToCeiling(Want(id: ""), paid: "100"))
        XCTAssertNil(WishlistLogic.compareToCeiling(want, paid: ""))
    }

    func testPriorityLabels() {
        XCTAssertEqual(WishlistLogic.priorityLabel("grail"), "Grail")
        XCTAssertEqual(WishlistLogic.priorityLabel("nonsense"), "Actively hunting")
    }
}

@MainActor
final class WishlistActionTests: XCTestCase {
    func testFindingAWantAddsTheItemAndKeepsTheHunt() async {
        let app = AppModel(config: .failure(.missing))
        await app.start()
        guard let want = WishlistLogic.open(app.wishlist).first else { return XCTFail("no open sample want") }
        let before = app.inventory.count
        app.markWantFound(want, found: .init(purchasePrice: "100"), itemPhotos: [], receiptPhotos: [])
        XCTAssertEqual(app.inventory.count, before + 1)
        let after = app.wishlist.first { $0.id == want.id }
        XCTAssertFalse(after?.foundAt.isEmpty ?? true)
        XCTAssertEqual(after?.foundItemId, app.inventory.first?.id)
    }

    func testANewWantKeepsANilCeiling() async {
        let app = AppModel(config: .failure(.missing))
        await app.start()
        app.saveWant(Want(id: "", name: "Something", maxPrice: nil))
        XCTAssertNil(app.wishlist.first { $0.name == "Something" }?.maxPrice)
    }
}

@MainActor
final class MorePagesTests: XCTestCase {
    func testTheSampleAdminStatsCarryEveryCheckState() throws {
        let object = try JSONSerialization.jsonObject(with: Data(SampleData.adminStatsJSON.utf8)) as? [String: Any]
        let checks = object?["checks"] as? [[String: Any]] ?? []
        XCTAssertEqual(Set(checks.compactMap { $0["status"] as? String }), ["ok", "watch", "act"])
    }

    func testPercentNeverRoundsUsageDownToZero() {
        XCTAssertEqual(AdminDashboard.percent(0.004), "<1%")
        XCTAssertEqual(AdminDashboard.percent(0.236), "24%")
        XCTAssertEqual(AdminDashboard.percent(.nan), "--")
    }

    func testRelativeTime() {
        let now = Date()
        XCTAssertEqual(AdminDashboard.relativeTime(nil, now: now), "never")
        XCTAssertEqual(AdminDashboard.relativeTime(now.addingTimeInterval(-5), now: now), "just now")
        XCTAssertEqual(AdminDashboard.relativeTime(now.addingTimeInterval(-3 * 3600), now: now), "3h ago")
    }

    func testTheReportPDFRenders() {
        let data = ReportPDF(items: SampleData.inventory().map { Mapping.fromDbItem($0) }).render()
        XCTAssertTrue(String(decoding: data.prefix(5), as: UTF8.self).hasPrefix("%PDF"))
    }

    func testFeedbackAndNameStayOnThePhone() async {
        let app = AppModel(config: .failure(.missing))
        await app.start()
        let before = app.feedback.count
        app.overlay.addFeedback(FeedbackRow(id: "f", userId: "u", description: "Hi", photos: PhotoColumn(), status: "new", createdAt: nil), summary: "Sent feedback")
        app.overlay.setAccountName("New Name", summary: "Renamed")
        XCTAssertEqual(app.feedback.count, before + 1)
        app.overlay.revertAll()
        XCTAssertEqual(app.feedback.count, before)
        XCTAssertNil(app.overlay.accountName)
    }
}
